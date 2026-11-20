# Visualization provenance

The eight complete videos are daylight validation demonstrations selected by a rule fixed before inference: within each task category, choose the sequence with frame count closest to 1,500 (at least 400 frames). Selection does not use prediction error or policy success.

The UAV and target routes are the recorded CARLA trajectories. Green annotations and lines are ground truth. Pink lines are real one-second auxiliary-head predictions from `pi05_history_target_aux_w2`, validation-selected step 20000, three-frame causal history, target loss weight 2. Native inference runs at every recorded 10 Hz observation. It uses the first-frame reference, causal image history, and measured UAV state, without ongoing target ground truth. The auxiliary decoder is inspected for visualization; it does not control the recorded trajectory.

The first three frames of each sequence are compared against the original native action sampler. `native-parity.jsonl` records the maximum action difference. Generation is isolated from benchmark evaluation and does not change its results, frozen weights, or checkpoints.

`assets/trajectories/<task>.json` contains the complete recorded UAV/target XYZ routes, per-frame predicted target XYZ positions, timing, source sequence, and coordinate definitions. World coordinates are shifted by the first UAV position. Forecasts are relative to the current UAV origin in the fixed initial-heading frame, with Z up. The video overlays reproject those 3D points into the original ERP image; the sphere viewer only changes the viewing direction.

Each downloadable trajectory figure uses the frame at one third of the sequence, selected by time rather than prediction quality. Figures include the complete route and a 3D one-second forecast, and are available as 300-dpi PNG and vector PDF.

The hero wall uses lightweight 32-second ambient previews. The main explorer and immersive viewer use the entire source sequence, with no 12-second cutoff or temporal subsampling. Playback speed changes viewing time, not recorded timestamps or model inputs.

These visualizations are expert-observation replay, not closed-loop policy rollouts. Aggregate online metrics remain separately identified in the results section.


## Predicted UAV actions (one second)

Blue paths visualize the native action expert’s current ten-step XYZ velocity chunk, integrated with dt = 0.1 s: d_k = 0.1 * sum(v_j, j=1..k), k=1..10. They use the physical velocities saved during the original native inference run. They do not use past UAV positions or outputs from later observations. Raw native velocities are retained without clipping; this is a planned action-chunk visualization, not a simulated execution of all ten commands.

The path begins beneath the camera and extends in its predicted movement direction, with an arrow at the one-second endpoint, following the visual placement of the UAV-Track-VLA demo. A constant 2 m downward display offset makes a near-horizontal flight plan visible below the camera rather than collapsing onto the horizon. This is a display convention: the offset is not added to the model output or to the numerical trajectories. The azimuth at the nadir follows the first action bearing; seam-crossing line segments are split. There is no depth-buffer occlusion test. In the full ERP image the path starts on the lower edge at its actual movement azimuth; when looking toward that direction in 360°, it extends from the lower part of the view.

Green target boxes and true target futures and pink auxiliary target predictions are retained. The ordinary and immersive players use the same video with blue predicted motion. Historical blue UAV trails and the top-view history inset have been removed from the videos. In the separate route plot, the measured UAV route is gray and its current one-second prediction is blue.

`assets/trajectories/<task>.json` includes the unshifted predicted UAV displacements, original predicted velocities, dt, coordinate definition, and video-only display offset. `uav-action-predictions.json` records each video's frame count and source/output hashes. The overlay uses CPU processing of the saved model outputs; it does not rerun inference or change the benchmark results.
