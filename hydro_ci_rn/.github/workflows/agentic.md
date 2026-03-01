# HydroMorph Agentic Workflow
# Uses GitHub Agentic Workflows (technical preview, Feb 2026)
# This file is compiled to Actions YAML via: gh aw compile
#
# Install: gh extension install github/gh-aw
# Compile: gh aw compile
# The compiled YAML runs as a standard GitHub Actions workflow.

## Issue Triage

When a new issue is opened, analyze it and:

1. If it mentions NIfTI parsing, file format errors, or gzip issues → label `parser`
2. If it mentions Evans Index, callosal angle, or wrong measurements → label `pipeline`  
3. If it mentions UI, display, mobile layout, or rendering → label `ui`
4. If it mentions Android/iOS build failures or Expo → label `build`
5. Add a comment summarizing the issue and suggesting which file(s to look at

## CI Failure Analysis

When a workflow run fails:

1. Read the failed step logs
2. Identify the root cause (dependency issue, build error, test failure)
3. Comment on the commit with the diagnosis and a suggested fix

## PR Review

When a pull request is opened or updated:

1. Check if pipeline logic in `src/pipeline/` was modified
2. If so, verify the changes maintain parity with the reference thresholds:
   - Brain mask: HU [-5, 80]
   - CSF mask: HU [0, 22]  
   - Evans threshold: 0.3
   - Callosal angle threshold: 90°
   - Volume threshold: 50 mL
   - Adaptive opening: skip if spacing < 0.7 or > 2.5mm
3. Flag any threshold changes as requiring clinical review
4. Check for common issues: off-by-one in voxel indexing, missing bounds checks
