/**
 * ResultsStore — Module-level store for multi-model results
 *
 * Avoids passing large typed arrays (ventricle masks ~10MB each)
 * through React Navigation params, which has a serialization limit.
 * Store data here; pass only a boolean flag via navigation.
 *
 * Author: Matheus Machado Rech
 */

let _results = null;

export function setResults(data) {
  _results = data;
}

export function getResults() {
  return _results;
}

export function clearResults() {
  _results = null;
}
