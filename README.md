# 360UAV-ETrack / 360UAV-TVLA

Static project website for **Towards 360° Embodied UAV Tracking Without Turning**.

**部署步骤请看 [DEPLOY.zh-CN.md](DEPLOY.zh-CN.md)。** This website is deployed from the `360UAV-ETrack_360UAV-TVLA_PAGE` branch of `LiBingyu01/360UAV-ETrack_360UAV-TVLA`. Choose GitHub Actions as the repository Pages source; pushes to this branch trigger deployment.

The package includes all eight complete demonstration videos, native one-second UAV action predictions, auxiliary target forecasts, an interactive 360° viewer, synchronized trajectory plots, high-resolution figures, and the supplied paper. All runtime assets use relative URLs and work under a repository subpath. There is no build dependency, external CDN, backend, or GPU requirement.

## Files

- `.github/workflows/pages.yml`: automatic deployment on `360UAV-ETrack_360UAV-TVLA_PAGE`.
- `index.html`, `styles.css`, `app.js`, `sphere.js`, `trajectories.js`: website.
- `assets/`: complete videos, figures, trajectory data, manuscript, and provenance.
- `tools/check_site.py`: checks assets, predicted-action data, paths and size limits.
- `tools/build_site.py`: stages public files into `_site`.
- `serve.py`: optional local preview with MP4 seeking support (`python serve.py`).

Videos are expert-observation replay, not closed-loop policy success cases. The blue UAV path integrates each current native ten-step velocity chunk at 0.1 s intervals. A constant downward display offset makes the path visible below the camera; numerical predictions retain their original frame. See `assets/provenance/README.md` for model, selection and verification details.

This is a deployment package. It does not set a public release date, invent public code/dataset URLs, or claim venue acceptance. License terms for the manuscript and media have not been assigned by this package.
