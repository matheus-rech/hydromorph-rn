/**
 * GradioClient — Lightweight Gradio API client for HuggingFace Spaces
 *
 * Implements the Gradio API protocol:
 *   1. Upload file via multipart POST to /gradio_api/upload
 *   2. Call endpoint via POST to /gradio_api/call/{endpoint} → get event_id
 *   3. Poll SSE stream at GET /gradio_api/call/{endpoint}/{eventId}
 *
 * Used by ApiModelProvider to call remote segmentation models
 * (e.g. NeuroSAM3 on HuggingFace Spaces).
 *
 * Author: Matheus Machado Rech
 */

const DEFAULT_TIMEOUT = 60000; // 60s

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an AbortController that auto-aborts after `ms` milliseconds.
 * Returns { controller, signal, clear } — call clear() on success to
 * prevent the timer from firing after the request completes.
 */
function timedAbort(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    controller,
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

/**
 * Strip trailing slash from a URL so we can safely append paths.
 */
function normalizeUrl(url) {
  return url.replace(/\/+$/, '');
}

/**
 * Parse the SSE text stream returned by the Gradio call-polling endpoint.
 *
 * The stream contains newline-delimited blocks:
 *   event: heartbeat\ndata: null
 *   event: complete\ndata: [...]
 *   event: error\ndata: "message"
 *
 * We scan for the first `event: complete` or `event: error` and return
 * the parsed data payload.
 */
function parseSSE(text) {
  const lines = text.split('\n');
  let currentEvent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('event:')) {
      currentEvent = line.slice('event:'.length).trim();
      continue;
    }

    if (line.startsWith('data:') && currentEvent) {
      const raw = line.slice('data:'.length).trim();

      if (currentEvent === 'complete') {
        try {
          return { ok: true, data: JSON.parse(raw) };
        } catch {
          return { ok: true, data: raw };
        }
      }

      if (currentEvent === 'error') {
        const msg = raw === 'null' ? 'Unknown Gradio error' : raw;
        return { ok: false, error: msg };
      }

      // heartbeat or unknown event — reset and continue
      currentEvent = null;
    }
  }

  return null; // no terminal event found yet
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload a file blob to the Gradio upload endpoint.
 *
 * In React Native (Hermes), we cannot easily construct a Blob from raw
 * base64.  Instead we append a file-like object with a data-URI to the
 * FormData — React Native's networking layer handles the conversion.
 *
 * @param {string} baseUrl   - HF Space URL (e.g. "https://mmrech-neurosam3.hf.space")
 * @param {string} base64Data - PNG image as base64 string (no data-URI prefix)
 * @param {string} fileName   - Filename for upload (e.g. "slice_042.png")
 * @param {number} [timeout]  - Timeout in ms (default 60 000)
 * @returns {Promise<{path: string, url: string}>} Server file reference
 */
export async function uploadFile(
  baseUrl,
  base64Data,
  fileName = 'image.png',
  timeout = DEFAULT_TIMEOUT,
) {
  const url = `${normalizeUrl(baseUrl)}/gradio_api/upload`;
  const { signal, clear } = timedAbort(timeout);

  try {
    const formData = new FormData();
    // React Native accepts { uri, name, type } as a file-like attachment.
    formData.append('files', {
      uri: `data:image/png;base64,${base64Data}`,
      name: fileName,
      type: 'image/png',
    });

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      signal,
      // Note: do NOT set Content-Type — fetch sets the multipart boundary.
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Upload failed (${res.status}): ${body || res.statusText}`,
      );
    }

    const json = await res.json();

    // Gradio returns an array of uploaded file paths, e.g.
    // [ "/tmp/gradio/abc123/image.png" ]
    if (!Array.isArray(json) || json.length === 0) {
      throw new Error('Upload returned unexpected response: ' + JSON.stringify(json));
    }

    const serverPath = json[0];
    return {
      path: serverPath,
      url: `${normalizeUrl(baseUrl)}/gradio_api/file=${serverPath}`,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Upload timed out after ${timeout}ms`);
    }
    throw err;
  } finally {
    clear();
  }
}

/**
 * Call a Gradio endpoint and wait for the result via SSE polling.
 *
 * Protocol:
 *   1. POST /gradio_api/call/{endpointName}  → { event_id }
 *   2. GET  /gradio_api/call/{endpointName}/{eventId}  → SSE stream
 *
 * @param {string} baseUrl
 * @param {string} endpointName - e.g. "process_with_status" (no leading slash)
 * @param {Array}  data         - Positional args array
 * @param {number} [timeout]    - Timeout in ms (default 60 000)
 * @returns {Promise<Array>} Result data array
 */
export async function callEndpoint(
  baseUrl,
  endpointName,
  data = [],
  timeout = DEFAULT_TIMEOUT,
) {
  const base = normalizeUrl(baseUrl);
  const endpoint = endpointName.replace(/^\/+/, '');

  // --- Step 1: Submit the call -------------------------------------------
  const submitUrl = `${base}/gradio_api/call/${endpoint}`;
  const { signal: submitSignal, clear: clearSubmit } = timedAbort(timeout);

  let eventId;
  try {
    const res = await fetch(submitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
      signal: submitSignal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Endpoint call failed (${res.status}): ${body || res.statusText}`,
      );
    }

    const json = await res.json();
    eventId = json.event_id;

    if (!eventId) {
      throw new Error(
        'Gradio call did not return event_id: ' + JSON.stringify(json),
      );
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Endpoint submit timed out after ${timeout}ms`);
    }
    throw err;
  } finally {
    clearSubmit();
  }

  // --- Step 2: Poll the SSE stream for the result ------------------------
  const pollUrl = `${base}/gradio_api/call/${endpoint}/${eventId}`;
  const { signal: pollSignal, clear: clearPoll } = timedAbort(timeout);

  try {
    const res = await fetch(pollUrl, { signal: pollSignal });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Result polling failed (${res.status}): ${body || res.statusText}`,
      );
    }

    const text = await res.text();
    const parsed = parseSSE(text);

    if (!parsed) {
      throw new Error(
        'SSE stream ended without a terminal event. Raw:\n' +
          text.slice(0, 500),
      );
    }

    if (!parsed.ok) {
      throw new Error(`Gradio endpoint error: ${parsed.error}`);
    }

    return parsed.data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Result polling timed out after ${timeout}ms`);
    }
    throw err;
  } finally {
    clearPoll();
  }
}

/**
 * High-level helper: upload a PNG image and run segmentation.
 *
 * Calls the `/process_with_status` endpoint with:
 *   [file_ref, prompt, modality, windowType]
 *
 * @param {string} baseUrl       - HF Space URL
 * @param {string} imageBase64   - PNG as base64 (no data-URI prefix)
 * @param {string} prompt        - Segmentation prompt, e.g. "ventricles"
 * @param {Object} [options]
 * @param {string} [options.modality="CT"]
 * @param {string} [options.windowType="Brain (Grey Matter)"]
 * @param {number} [options.timeout=60000]
 * @returns {Promise<{imageUrl: string|null, status: string}>}
 */
export async function segmentImage(
  baseUrl,
  imageBase64,
  prompt = 'ventricles',
  options = {},
) {
  const {
    modality = 'CT',
    windowType = 'Brain (Grey Matter)',
    timeout = DEFAULT_TIMEOUT,
  } = options;

  const base = normalizeUrl(baseUrl);

  // 1. Upload the image
  const fileRef = await uploadFile(base, imageBase64, 'slice.png', timeout);

  // 2. Build the file reference object Gradio expects
  const gradioFileRef = {
    path: fileRef.path,
    orig_name: 'slice.png',
    size: Math.ceil((imageBase64.length * 3) / 4), // approximate decoded size
    mime_type: 'image/png',
  };

  // 3. Call /process_with_status
  const result = await callEndpoint(
    base,
    'process_with_status',
    [gradioFileRef, prompt, modality, windowType],
    timeout,
  );

  // 4. Parse the result — expected: [segmentation_image, status_text]
  //    segmentation_image is either a file ref object or null
  //    status_text is a plain string
  let imageUrl = null;
  let status = 'unknown';

  if (Array.isArray(result)) {
    const [imgResult, statusText] = result;

    // The image result may be a file ref object with a `url` or `path` field
    if (imgResult && typeof imgResult === 'object' && imgResult.path) {
      imageUrl = `${base}/gradio_api/file=${imgResult.path}`;
    } else if (imgResult && typeof imgResult === 'string') {
      // Could be a direct URL or base64
      imageUrl = imgResult;
    }

    status = typeof statusText === 'string' ? statusText : JSON.stringify(statusText);
  }

  return { imageUrl, status };
}

/**
 * Check if a Gradio space is reachable by hitting its root URL.
 *
 * @param {string} baseUrl  - HF Space URL
 * @param {number} [timeout] - Timeout in ms (default 10 000)
 * @returns {Promise<{ok: boolean, status: string}>}
 */
export async function checkHealth(baseUrl, timeout = 10000) {
  const url = `${normalizeUrl(baseUrl)}/gradio_api/info`;
  const { signal, clear } = timedAbort(timeout);

  try {
    const res = await fetch(url, { signal });

    if (res.ok) {
      return { ok: true, status: `reachable (${res.status})` };
    }

    return { ok: false, status: `HTTP ${res.status}: ${res.statusText}` };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, status: `timeout after ${timeout}ms` };
    }
    return { ok: false, status: err.message };
  } finally {
    clear();
  }
}
