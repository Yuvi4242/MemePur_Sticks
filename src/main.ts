import './styles/tokens.css';
import './styles/base.css';
import { CameraComponent } from './components/camera';
import { MLDetection } from './ml/detection';
import { HUDComponent } from './components/hud';
import { StatsStore } from './state/stats-store';
import { MLSegmentation } from './ml/segmentation';

console.log('Meme Verse 2.0 // Terminal HUD Initialized');

// App DOM Setup
const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.innerHTML = `
    <div class="hud-app-wrapper" style="display: flex; flex-direction: column; height: 100vh; overflow: hidden;">
      <!-- Header / Top Bar -->
      <header class="hud-header" style="height: var(--header-height); border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; background-color: var(--bg-panel); z-index: 10; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <h1 class="hud-logo" style="color: var(--accent-primary); font-size: 20px; margin: 0;">MEME VERSE 2.0</h1>
          <div class="hud-status-pill" style="height: 22px;">
            <span class="hud-status-dot lime"></span>
            <span style="font-size: 9px; font-weight: bold;">SYS_ACTIVE</span>
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 20px;">
          <!-- Streak Counter -->
          <div id="streak-counter" style="font-size: 11px; letter-spacing: 0.1em; color: var(--text-secondary); font-weight: bold;">
            STREAK <span id="streak-days" style="color: var(--accent-primary); font-variant-numeric: tabular-nums;">--</span> DAYS
          </div>
          
          <!-- Status Indicators -->
          <div style="display: flex; align-items: center; gap: 12px;">
            <!-- Camera status dot -->
            <div class="hud-status-pill" style="height: 22px;" aria-label="Camera Status: Active">
              <span class="hud-status-dot lime"></span>
              <span style="font-size: 9px; font-weight: bold;">CAM: LIVE</span>
            </div>
            
            <!-- ML Engine status dot/pill -->
            <div id="ml-status-container" class="hud-status-pill" style="height: 22px;" aria-label="ML Status: Loading 0%">
              <span id="ml-status-dot" class="hud-status-dot gray"></span>
              <span id="ml-status-text" style="font-size: 9px; font-weight: bold;">ML: LOADING 0%</span>
            </div>
          </div>
          
          <!-- Night Mode Toggle -->
          <button id="theme-toggle" class="hud-bracket-badge active" aria-label="Toggle night mode. Currently active.">NIGHT MODE [ON]</button>
        </div>
      </header>
      
      <!-- Main Content Area -->
      <div style="display: flex; flex: 1; min-height: 0;">
        <!-- Left Sidebar -->
        <aside style="width: var(--sidebar-width); border-right: 1px solid var(--border-color); background-color: var(--bg-deep); padding: 24px; display: flex; flex-direction: column; justify-content: space-between; flex-shrink: 0;">
          <div style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
            <h2 style="font-size: 11px; color: var(--text-muted); margin-bottom: 16px; letter-spacing: 0.1em;">GESTURE TRIGGERS</h2>
            
            <!-- Config-driven rows container -->
            <div id="sidebar-rows-container" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; min-height: 0;">
              <!-- Dynamically populated rows -->
              <div style="font-size: 11px; color: var(--text-muted); padding: 10px;">Loading triggers...</div>
            </div>
          </div>
          
          <!-- Stats Summary Panel -->
          <div style="margin-top: 24px; border-top: 1px solid var(--border-color); padding-top: 16px; flex-shrink: 0;">
            <h2 style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px; letter-spacing: 0.1em;">HUD STATISTICS</h2>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.8;" class="hud-numbers">
              <div style="display: flex; justify-content: space-between;">
                <span>TOTAL TRG:</span>
                <span id="stats-total-trg" style="color: var(--text-primary); font-weight: bold;">0</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>MOST GEST:</span>
                <span id="stats-most-gest" style="color: var(--accent-primary); font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px;" title="None">--</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>MOST EXPR:</span>
                <span id="stats-most-expr" style="color: var(--accent-secondary); font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px;" title="None">--</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>COMBOS:</span>
                <span id="stats-total-combos" style="color: var(--text-primary); font-weight: bold;">0</span>
              </div>
            </div>
            
            <!-- Reset Button -->
            <button id="reset-stats-btn" class="hud-diagnostic-btn" style="width: 100%; margin-top: 16px; font-size: 10px; padding: 6px 12px;" aria-label="Reset statistics">RESET HUD STATS</button>
          </div>
        </aside>
        
        <!-- Center/Main Camera Panel -->
        <main style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; background-color: var(--bg-primary); min-height: 0; overflow-y: auto;">
          <!-- Camera Component mount node -->
          <div id="camera-mount" style="position: relative; width: 100%; max-width: 640px; display: flex; justify-content: center;"></div>
          
          <!-- Bottom Toolbar -->
          <div class="hud-bottom-toolbar" style="width: 100%; max-width: 640px; margin-top: 24px; flex-shrink: 0;">
            <!-- Confidence Sensitivity Slider -->
            <div class="hud-slider-container" style="flex: 1; max-width: 340px;">
              <span id="slider-val-label" class="hud-slider-label">CONFIDENCE: 0.75</span>
              <input type="range" id="confidence-slider" class="hud-slider" min="40" max="95" value="75" step="5" aria-label="Confidence threshold slider" />
            </div>
            
            <!-- FPS / Latency Metrics -->
            <div style="display: flex; gap: 16px; font-size: 11px; font-weight: bold; color: var(--text-secondary); letter-spacing: 0.05em;" class="hud-numbers">
              <div>FPS: <span id="metric-fps" style="color: var(--text-primary);">0</span></div>
              <div>LATENCY: <span id="metric-latency" style="color: var(--text-primary);">-- MS</span></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  // --- Theme Toggle Logic ---
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      if (currentTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.classList.add('active');
        themeToggle.innerText = 'NIGHT MODE [ON]';
        themeToggle.setAttribute('aria-label', 'Toggle night mode. Currently active.');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggle.classList.remove('active');
        themeToggle.innerText = 'NIGHT MODE [OFF]';
        themeToggle.setAttribute('aria-label', 'Toggle night mode. Currently inactive.');
      }
    });
  }

  // --- Stats Persistence Setup ---
  const updateStatsUI = () => {
    const stats = StatsStore.getStats();
    
    // Update daily streak
    const streakDaysEl = document.getElementById('streak-days');
    if (streakDaysEl) {
      streakDaysEl.innerText = stats.streak > 0 ? stats.streak.toString() : '--';
    }

    // Update statistics display
    const totalTrgEl = document.getElementById('stats-total-trg');
    if (totalTrgEl) totalTrgEl.innerText = (stats.totalGestures + stats.totalExpressions).toString();

    const mostGestEl = document.getElementById('stats-most-gest');
    if (mostGestEl) {
      mostGestEl.innerText = stats.mostUsedGesture;
      mostGestEl.title = `Most used hand gesture: ${stats.mostUsedGesture}`;
    }

    const mostExprEl = document.getElementById('stats-most-expr');
    if (mostExprEl) {
      mostExprEl.innerText = stats.mostUsedExpression;
      mostExprEl.title = `Most used face expression: ${stats.mostUsedExpression}`;
    }

    const totalCombosEl = document.getElementById('stats-total-combos');
    if (totalCombosEl) totalCombosEl.innerText = stats.totalCombos.toString();
  };

  // Run initial streak check and display
  StatsStore.updateStreak();
  updateStatsUI();

  // Reset Stats button handler
  const resetStatsBtn = document.getElementById('reset-stats-btn');
  if (resetStatsBtn) {
    resetStatsBtn.addEventListener('click', () => {
      const didReset = StatsStore.resetStats();
      if (didReset) {
        updateStatsUI();
      }
    });
  }

  // --- Sensitivity Slider Logic ---
  const slider = document.getElementById('confidence-slider') as HTMLInputElement;
  const sliderLabel = document.getElementById('slider-val-label');
  let currentThreshold = 0.75;

  if (slider) {
    slider.addEventListener('input', () => {
      const val = parseInt(slider.value, 10) / 100;
      currentThreshold = val;
      if (sliderLabel) {
        sliderLabel.innerText = `CONFIDENCE: ${val.toFixed(2)}`;
      }
    });
  }

  // --- ML Initialization and Status dot ---
  const mlStatusDot = document.getElementById('ml-status-dot');
  const mlStatusText = document.getElementById('ml-status-text');
  const mlStatusContainer = document.getElementById('ml-status-container');

  const onProgress = (percent: number) => {
    if (mlStatusDot) {
      mlStatusDot.className = 'hud-status-dot gray';
    }
    if (mlStatusText) {
      mlStatusText.innerText = `ML: LOADING ${percent}%`;
    }
    if (mlStatusContainer) {
      mlStatusContainer.setAttribute('aria-label', `ML Status: Loading ${percent}%`);
    }
  };

  const onLoaded = () => {
    if (mlStatusDot) {
      mlStatusDot.className = 'hud-status-dot cyan';
      mlStatusDot.style.boxShadow = '0 0 8px var(--status-cyan)';
    }
    if (mlStatusText) {
      mlStatusText.innerText = 'ML: READY';
    }
    if (mlStatusContainer) {
      mlStatusContainer.setAttribute('aria-label', 'ML Status: Ready');
    }
  };

  const onFailed = (err: any) => {
    console.error('ML Initialization Failure:', err);
    if (mlStatusDot) {
      mlStatusDot.className = 'hud-status-dot red';
      mlStatusDot.style.boxShadow = '0 0 8px var(--status-red)';
    }
    if (mlStatusText) {
      mlStatusText.innerHTML = `ML: ERROR <button id="ml-retry-btn" class="hud-bracket-badge" style="color: var(--status-red); border: 1px solid var(--status-red); padding: 0 4px; font-size: 8px; margin-left: 6px; cursor: pointer;" aria-label="Retry loading ML models">RETRY</button>`;
      
      const retryBtn = document.getElementById('ml-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          initializeML();
        });
      }
    }
    if (mlStatusContainer) {
      mlStatusContainer.setAttribute('aria-label', `ML Status: Error. Description: ${err.message || err}`);
    }
  };

  const mlEngine = new MLDetection(onProgress, onFailed);

  const initializeML = async () => {
    try {
      onProgress(0);
      await mlEngine.init();
      onLoaded();
      
      // Once loaded, populate configs in the sidebar
      // @ts-ignore
      const gestures = mlEngine.gestureConfigs || [];
      // @ts-ignore
      const expressions = mlEngine.expressionConfigs || [];
      const sidebarContainer = document.getElementById('sidebar-rows-container');
      if (sidebarContainer) {
        sidebarContainer.innerHTML = '';
        [...gestures, ...expressions].forEach((item: any) => {
          const row = document.createElement('div');
          row.className = 'hud-sidebar-row';
          row.id = `sidebar-row-${item.id}`;
          row.innerHTML = `
            <span>${item.displayName.toUpperCase()}</span>
            <span class="action-value">${item.animationType.toUpperCase()}</span>
          `;
          sidebarContainer.appendChild(row);
        });
      }
    } catch (e) {
      onFailed(e);
    }
  };

  // Kick off ML engine loading
  initializeML();

  // --- Segmentation Engine Setup (Lazy Loaded) ---
  let isSegmenting = false;
  let activeSessionId = 0; // session token cancellation guard

  const onSegmentationProgress = (percent: number) => {
    const statusText = document.getElementById('segmentation-status-text');
    if (statusText) {
      statusText.innerText = `PROCESSING: ${percent}%`;
    }
  };

  const mlSegmentation = new MLSegmentation(onSegmentationProgress);

  // Helper: Display soft non-blocking status pill notifications
  const showNoticePill = (parent: HTMLElement, text: string, dotColor: string) => {
    const notice = document.createElement('div');
    notice.className = 'hud-status-pill';
    notice.style.position = 'absolute';
    notice.style.top = '16px';
    notice.style.right = '16px';
    notice.style.zIndex = '12';
    notice.innerHTML = `
      <span class="hud-status-dot ${dotColor}"></span>
      <span>${text}</span>
    `;
    parent.appendChild(notice);

    setTimeout(() => {
      if (notice.parentNode) {
        notice.parentNode.removeChild(notice);
      }
    }, 2500);
  };

  let camera: CameraComponent | null = null;

  // Helper: Apply Fallback crops (Circular Face or Centered Square)
  const applyFallbackCrop = (sessionId: number) => {
    if (!camera) return;
    if (sessionId !== activeSessionId) return;

    const mainCanvas = cameraMount?.querySelector('canvas') as HTMLCanvasElement;
    if (!mainCanvas) return;
    const ctx = mainCanvas.getContext('2d');
    if (!ctx) return;

    const cameraContainer = cameraMount?.querySelector('.hud-camera-container') as HTMLElement;
    const meta = camera.getCapturedMetadata();

    if (meta && meta.faceBbox) {
      // Circular clip centered on face bbox
      const bbox = meta.faceBbox;
      const faceWidth = (bbox.xmax - bbox.xmin) * mainCanvas.width;
      const faceHeight = (bbox.ymax - bbox.ymin) * mainCanvas.height;
      
      // Mirrored X center coordinates logic
      const origCenterX = (bbox.xmin + bbox.xmax) / 2;
      const cx = (1.0 - origCenterX) * mainCanvas.width;
      const cy = ((bbox.ymin + bbox.ymax) / 2) * mainCanvas.height;
      const radius = Math.max(faceWidth, faceHeight) * 1.2;

      const offscreen = document.createElement('canvas');
      offscreen.width = mainCanvas.width;
      offscreen.height = mainCanvas.height;
      const oCtx = offscreen.getContext('2d');

      if (oCtx) {
        oCtx.beginPath();
        oCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        oCtx.clip();
        oCtx.drawImage(mainCanvas, 0, 0);
      }

      ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
      ctx.drawImage(offscreen, 0, 0);
    } else {
      // Fallback-of-fallback: Center square crop (80% of shorter side)
      const minDim = Math.min(mainCanvas.width, mainCanvas.height);
      const cropSize = minDim * 0.8;
      const sx = (mainCanvas.width - cropSize) / 2;
      const sy = (mainCanvas.height - cropSize) / 2;

      const offscreen = document.createElement('canvas');
      offscreen.width = mainCanvas.width;
      offscreen.height = mainCanvas.height;
      const oCtx = offscreen.getContext('2d');

      if (oCtx) {
        oCtx.beginPath();
        oCtx.rect(sx, sy, cropSize, cropSize);
        oCtx.clip();
        oCtx.drawImage(mainCanvas, 0, 0);
      }

      ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
      ctx.drawImage(offscreen, 0, 0);
    }

    if (camera) {
      const cropCopy = document.createElement('canvas');
      cropCopy.width = mainCanvas.width;
      cropCopy.height = mainCanvas.height;
      const ccCtx = cropCopy.getContext('2d');
      if (ccCtx) {
        ccCtx.drawImage(mainCanvas, 0, 0);
      }
      camera.setCutout(cropCopy);
    }

    if (cameraContainer) {
      showNoticePill(cameraContainer, 'FALLBACK CROP APPLIED', 'red');
    }
  };

  // --- Camera Component Setup & Mounting ---
  const cameraMount = document.getElementById('camera-mount');
  if (cameraMount) {
    camera = new CameraComponent(cameraMount, (capturedDataUrl) => {
      if (capturedDataUrl) {
        // Increment session ID to cancel out previous runs
        const sessionId = ++activeSessionId;
        isSegmenting = true;

        if (hud) hud.clear();

        // Show "PROCESSING: 0%" loading overlay
        const progressPill = document.createElement('div');
        progressPill.id = 'segmentation-progress-pill';
        progressPill.className = 'hud-status-pill';
        progressPill.style.position = 'absolute';
        progressPill.style.top = '50%';
        progressPill.style.left = '50%';
        progressPill.style.transform = 'translate(-50%, -50%)';
        progressPill.style.zIndex = '15';
        progressPill.innerHTML = `
          <span class="hud-status-dot cyan"></span>
          <span id="segmentation-status-text">PROCESSING: 0%</span>
        `;
        
        const cameraContainer = cameraMount.querySelector('.hud-camera-container') as HTMLElement;
        if (cameraContainer) {
          cameraContainer.appendChild(progressPill);
        }

        // Run lazy loading and segmentation inside a 3.5s timeout race
        const runSegmentation = async () => {
          if (!mlSegmentation.isInitialized()) {
            await mlSegmentation.init();
          }

          if (sessionId !== activeSessionId) return null;

          const mainCanvas = cameraMount.querySelector('canvas') as HTMLCanvasElement;
          if (!mainCanvas) throw new Error('Still frame canvas not found');

          return await mlSegmentation.segmentFrame(mainCanvas);
        };

        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT')), 3500);
        });

        Promise.race([runSegmentation(), timeoutPromise])
          .then((cutoutCanvas) => {
            if (sessionId !== activeSessionId) return;

            // Remove progress indicator
            if (progressPill.parentNode) {
              progressPill.parentNode.removeChild(progressPill);
            }

            if (cutoutCanvas) {
              const mainCanvas = cameraMount.querySelector('canvas') as HTMLCanvasElement;
              if (mainCanvas) {
                const ctx = mainCanvas.getContext('2d');
                if (ctx) {
                  ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
                  ctx.drawImage(cutoutCanvas, 0, 0);
                }
              }
              showNoticePill(cameraContainer, 'CUTOUT GENERATED', 'lime');
              if (camera) {
                camera.setCutout(cutoutCanvas);
              }
            }
            isSegmenting = false;
          })
          .catch((err) => {
            if (sessionId !== activeSessionId) return;

            // Remove progress indicator
            if (progressPill.parentNode) {
              progressPill.parentNode.removeChild(progressPill);
            }

            console.warn('Segmentation failed, running crop fallback:', err);
            applyFallbackCrop(sessionId);
            isSegmenting = false;
          });
      } else {
        // Retake clicked: Invalidate session ID and resume live detections
        activeSessionId++;
        isSegmenting = false;

        const progressPill = cameraMount.querySelector('#segmentation-progress-pill');
        if (progressPill && progressPill.parentNode) {
          progressPill.parentNode.removeChild(progressPill);
        }

        updateStatsUI();
      }
    });

    // Hook setOnCaptureRequest callback to freeze metadata snapshots
    camera?.setOnCaptureRequest(() => {
      let faceBbox = null;
      if (debouncedExpression && debouncedExpression.landmarks) {
        let xmin = 1.0, xmax = 0.0, ymin = 1.0, ymax = 0.0;
        debouncedExpression.landmarks.forEach((pt: any) => {
          if (pt.x < xmin) xmin = pt.x;
          if (pt.x > xmax) xmax = pt.x;
          if (pt.y < ymin) ymin = pt.y;
          if (pt.y > ymax) ymax = pt.y;
        });
        faceBbox = { xmin, ymin, xmax, ymax };
      }

      return {
        gestureLabel: debouncedGesture ? debouncedGesture.label : null,
        gestureConfidence: debouncedGesture ? debouncedGesture.confidence : null,
        expressionLabel: debouncedExpression ? debouncedExpression.label : null,
        expressionConfidence: debouncedExpression ? debouncedExpression.confidence : null,
        isCombo: !!debouncedCombo,
        comboLabel: debouncedCombo,
        faceBbox
      };
    });

    camera?.mount();

    // --- HUD Component Setup ---
    let hud: HUDComponent | null = null;

    // --- Classification Debounce States ---
    let currentGestureCandidate: string | null = null;
    let gestureCandidateStartTime = 0;
    let debouncedGesture: { label: string; confidence: number; landmarks: any[] | null } | null = null;

    let currentExpressionCandidate: string | null = null;
    let expressionCandidateStartTime = 0;
    let debouncedExpression: { label: string; confidence: number; landmarks: any[] | null } | null = null;

    let currentComboCandidate: string | null = null;
    let comboCandidateStartTime = 0;
    let debouncedCombo: string | null = null;

    // To ensure we increment once per state transition
    let lastRecordedGesture: string | null = null;
    let lastRecordedExpression: string | null = null;
    let lastRecordedCombo: string | null = null;

    // --- FPS Tracking variables ---
    let frameTimes: number[] = [];
    const metricFps = document.getElementById('metric-fps');
    const metricLatency = document.getElementById('metric-latency');

    // Hook frame callback
    camera?.setOnFrame((canvas, timestamp) => {
      // Inhibit live Hand/Face loop during active segmentation
      if (isSegmenting) return;

      // 1. Calculate FPS
      const now = performance.now();
      frameTimes.push(now);
      if (frameTimes.length > 30) {
        frameTimes.shift();
      }
      if (frameTimes.length > 1 && metricFps) {
        const duration = (frameTimes[frameTimes.length - 1] - frameTimes[0]) / (frameTimes.length - 1);
        const fps = Math.round(1000 / duration);
        metricFps.innerText = fps.toString();
        mlEngine.updateFps(fps);
      }

      // 2. Instantiate HUD Overlay wrapper on the fly once camera is streaming
      if (!hud && camera) {
        const hudOverlayNode = camera.getHUDContainer();
        if (hudOverlayNode) {
          hud = new HUDComponent(hudOverlayNode);
        }
      }

      // 3. Run Inference
      const result = mlEngine.detectFrame(canvas, timestamp);
      if (result) {
        // Update latency metrics readout
        if (metricLatency) {
          metricLatency.innerText = `${Math.round(result.latencyMs)} MS`;
        }

        // Apply dynamic confidence slider filter
        if (result.gesture && result.gesture.confidence < currentThreshold) {
          result.gesture = null;
        }
        if (result.expression && result.expression.confidence < currentThreshold) {
          result.expression = null;
        }
        if (!result.gesture || !result.expression) {
          result.combo = null;
        }

        // 4. Debounce Logic (300ms threshold)
        const DEBOUNCE_MS = 300;

        // A. Gesture Debounce
        const rawGestureId = result.gesture ? result.gesture.label : null;
        if (rawGestureId !== currentGestureCandidate) {
          currentGestureCandidate = rawGestureId;
          gestureCandidateStartTime = now;
        } else if (rawGestureId === currentGestureCandidate) {
          if (now - gestureCandidateStartTime >= DEBOUNCE_MS) {
            debouncedGesture = result.gesture;
          }
        }

        // B. Expression Debounce
        const rawExpressionId = result.expression ? result.expression.label : null;
        if (rawExpressionId !== currentExpressionCandidate) {
          currentExpressionCandidate = rawExpressionId;
          expressionCandidateStartTime = now;
        } else if (rawExpressionId === currentExpressionCandidate) {
          if (now - expressionCandidateStartTime >= DEBOUNCE_MS) {
            debouncedExpression = result.expression;
          }
        }

        // C. Combo Debounce
        const rawComboId = result.combo;
        if (rawComboId !== currentComboCandidate) {
          currentComboCandidate = rawComboId;
          comboCandidateStartTime = now;
        } else if (rawComboId === currentComboCandidate) {
          if (now - comboCandidateStartTime >= DEBOUNCE_MS) {
            debouncedCombo = rawComboId;
          }
        }

        // 5. Update Statistics and UI on Confirm (Once per confirmed trigger)
        let statsUpdated = false;

        // Record confirmed Gesture
        const finalGestureLabel = debouncedGesture ? debouncedGesture.label : null;
        if (finalGestureLabel !== lastRecordedGesture) {
          if (finalGestureLabel) {
            StatsStore.recordGesture(finalGestureLabel);
            statsUpdated = true;
          }
          lastRecordedGesture = finalGestureLabel;
        }

        // Record confirmed Expression
        const finalExpressionLabel = debouncedExpression ? debouncedExpression.label : null;
        if (finalExpressionLabel !== lastRecordedExpression) {
          if (finalExpressionLabel) {
            StatsStore.recordExpression(finalExpressionLabel);
            statsUpdated = true;
          }
          lastRecordedExpression = finalExpressionLabel;
        }

        // Record confirmed Combo
        if (debouncedCombo !== lastRecordedCombo) {
          if (debouncedCombo) {
            StatsStore.recordCombo(debouncedCombo);
            statsUpdated = true;
          }
          lastRecordedCombo = debouncedCombo;
        }

        if (statsUpdated) {
          updateStatsUI();
        }

        // 6. Draw HUD overlays
        if (hud) {
          hud.update({
            gesture: debouncedGesture,
            expression: debouncedExpression,
            combo: debouncedCombo,
            // Pass all raw hand landmarks for secondary drawing (if > 1 hand)
            // @ts-ignore
            allHands: result.gesture ? [result.gesture.landmarks] : []
          });
        }

        // 7. Update sidebar highlighting based on debounced active items
        const sidebarRows = document.querySelectorAll('.hud-sidebar-row');
        sidebarRows.forEach((row) => row.classList.remove('active'));

        if (finalGestureLabel) {
          const row = document.getElementById(`sidebar-row-${finalGestureLabel}`);
          if (row) row.classList.add('active');
        }
        if (finalExpressionLabel) {
          const row = document.getElementById(`sidebar-row-${finalExpressionLabel}`);
          if (row) row.classList.add('active');
        }
      } else {
        if (metricLatency) {
          metricLatency.innerText = '-- MS';
        }
      }
    });
  }
}
