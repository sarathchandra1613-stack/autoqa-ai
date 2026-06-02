// AutoQA AI Dashboard Logic
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const apiStatusText = document.getElementById('api-status-text');
  const pulseDot = document.querySelector('.pulse-dot');
  const genModeBadge = document.getElementById('gen-mode-badge');
  
  const requirementInput = document.getElementById('requirement-input');
  const templateSelect = document.getElementById('template-select');
  const saveCheckbox = document.getElementById('save-checkbox');
  
  const btnGenerate = document.getElementById('btn-generate');
  const btnGenText = document.getElementById('btn-gen-text');
  const btnGenSpinner = document.getElementById('btn-gen-spinner');
  
  const btnClearTerminal = document.getElementById('btn-clear-terminal');
  const btnViewReport = document.getElementById('btn-view-report');
  const terminalOutput = document.getElementById('terminal-output');
  
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  const activeFilename = document.getElementById('active-filename');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const btnRunCode = document.getElementById('btn-run-code');
  const btnRunSpinner = document.getElementById('btn-run-spinner');
  const codeDisplay = document.getElementById('code-display');
  
  const btnRefreshSaved = document.getElementById('btn-refresh-saved');
  const savedTestsBody = document.getElementById('saved-tests-body');
  
  const reportModal = document.getElementById('report-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const reportIframe = document.getElementById('report-iframe');

  // Active state
  let currentLoadedScript = null;
  let isGenerating = false;
  let isRunning = false;

  // Preset templates mapping
  const templates = {
    login: `User login functionality:
- User navigates to the login page.
- Happy path: user enters email "test@example.com" and password "password". Clicking submit redirects to the dashboard URL.
- Negative path: user enters invalid email and password. Clicking submit shows an error message indicating incorrect credentials.`,
    
    search: `Product Search and Filtering:
- User goes to the e-commerce home page.
- Happy path: user types "laptop" in the search search bar and hits enter. Verify that at least 3 search results are displayed and contain the word "laptop".
- Validation path: user leaves the search input blank and clicks search. Verify that a validation warning "Please enter search keyword" appears.`,
    
    checkout: `Cart & Checkout Flow:
- User goes to the product catalog page.
- Happy path: clicks "Add to Cart" on the first product, opens the cart checkout drawer, verifies the product is present, enters shipping information, and submits payment. Verify success page shown.
- Error path: user enters invalid card number. Verify card payment error is displayed.`,
    
    contact: `Contact Us Submission:
- User visits the contact page.
- Happy path: user fills Name, Email, and Message, and clicks Submit. Verify a confirmation toast "Message sent successfully" appears.
- Validation path: user submits without entering an Email. Verify email field displays "Email is required" validation error.`
  };

  // 1. Initial health check & setup
  async function checkServerStatus() {
    try {
      const res = await fetch('/');
      if (res.ok) {
        const data = await res.json();
        apiStatusText.textContent = `Connected (Phase 2)`;
        pulseDot.className = 'pulse-dot online';
        
        // Update generation mode badge if returned from server
        if (data.mode) {
          updateModeBadge(data.mode);
        } else {
          // Fallback check
          updateModeBadge('offline');
        }
      } else {
        throw new Error('API returned unhealthy code');
      }
    } catch (err) {
      apiStatusText.textContent = `Offline / Reconnecting`;
      pulseDot.className = 'pulse-dot offline';
      addLogLine('System error connecting to backend: ' + err.message, 'error');
    }
  }

  function updateModeBadge(mode) {
    genModeBadge.textContent = mode === 'gemini' ? 'Gemini AI Mode' : 'Offline Mode';
    genModeBadge.className = `mode-badge ${mode}`;
  }

  // 2. Logging Helpers
  function addLogLine(text, type = 'stdout') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    // Replace escape codes if any
    line.textContent = text.replace(/\u001b\[\d+m/g, ''); 
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  function clearTerminal() {
    terminalOutput.innerHTML = '';
    addLogLine('=== Logs Cleared ===', 'system');
  }

  // 3. Tab Switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });

  function switchTab(tabId) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.click();
  }

  // 4. Fill Preset Template
  templateSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (templates[val]) {
      requirementInput.value = templates[val];
      addLogLine(`Loaded preset: ${val} flow.`, 'info');
    }
  });

  // 5. Generate Playwright script
  btnGenerate.addEventListener('click', async () => {
    const text = requirementInput.value.trim();
    if (!text) {
      addLogLine('Please enter a test requirement first.', 'warning');
      alert('Please write a test requirement description first.');
      return;
    }

    isGenerating = true;
    btnGenerate.disabled = true;
    btnGenText.textContent = 'Generating...';
    btnGenSpinner.classList.remove('hide');
    addLogLine('Sending script generation request to FastAPI...', 'system');

    try {
      const response = await fetch('/generate-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          save: saveCheckbox.checked
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate test script');
      }

      const data = await response.json();
      addLogLine(`Script generated successfully! (Provider mode: ${data.mode})`, 'success');
      
      // Load script into UI
      codeDisplay.textContent = data.generated_script;
      currentLoadedScript = data.saved_path ? data.saved_path.replace('generated-tests/', '') : null;
      
      if (currentLoadedScript) {
        activeFilename.textContent = currentLoadedScript;
        btnRunCode.disabled = false;
        addLogLine(`Saved script as: ${data.saved_path}`, 'success');
      } else {
        activeFilename.textContent = 'Unsaved script';
        btnRunCode.disabled = true;
      }
      
      btnCopyCode.disabled = false;
      updateModeBadge(data.mode);
      switchTab('tab-code');
      fetchSavedTests(); // Refresh the list
      
    } catch (err) {
      addLogLine(`Generation failed: ${err.message}`, 'error');
      alert(`Generation failed: ${err.message}`);
    } finally {
      isGenerating = false;
      btnGenerate.disabled = false;
      btnGenText.textContent = 'Generate Test';
      btnGenSpinner.classList.add('hide');
    }
  });

  // 6. Fetch saved tests list
  async function fetchSavedTests() {
    try {
      const response = await fetch('/tests');
      if (!response.ok) throw new Error('Failed to load saved tests list');
      
      const data = await response.json();
      const list = data.tests || [];
      
      if (list.length === 0) {
        savedTestsBody.innerHTML = `
          <tr>
            <td colspan="4" class="empty-list">No scripts found. Generate a script to begin.</td>
          </tr>
        `;
        return;
      }

      savedTestsBody.innerHTML = list.map(test => {
        const dateStr = new Date(test.modified_at).toLocaleString();
        const sizeKB = (test.size_bytes / 1024).toFixed(2) + ' KB';
        return `
          <tr>
            <td class="filename-cell" title="${test.filename}">${test.filename}</td>
            <td class="date-cell">${dateStr}</td>
            <td class="size-cell">${sizeKB}</td>
            <td class="actions-cell">
              <button class="btn btn-secondary btn-small action-load" data-file="${test.filename}">Load</button>
              <button class="btn btn-accent btn-small action-run" data-file="${test.filename}">Run</button>
            </td>
          </tr>
        `;
      }).join('');

      // Add actions click listener
      document.querySelectorAll('.action-load').forEach(btn => {
        btn.addEventListener('click', () => loadSavedScript(btn.getAttribute('data-file')));
      });

      document.querySelectorAll('.action-run').forEach(btn => {
        btn.addEventListener('click', () => executeTest(btn.getAttribute('data-file')));
      });

    } catch (err) {
      addLogLine('Error listing saved tests: ' + err.message, 'error');
    }
  }

  // 7. Fetch single test file content to view in editor
  async function loadSavedScript(filename) {
    addLogLine(`Loading test script: ${filename}...`, 'system');
    try {
      const response = await fetch(`/generated-tests/${filename}`);
      if (!response.ok) throw new Error('Could not read file content');
      
      const scriptText = await response.text();
      codeDisplay.textContent = scriptText;
      currentLoadedScript = filename;
      activeFilename.textContent = filename;
      btnCopyCode.disabled = false;
      btnRunCode.disabled = false;
      
      addLogLine(`Loaded script: ${filename}`, 'success');
      switchTab('tab-code');
    } catch (err) {
      addLogLine(`Failed to load script content: ${err.message}`, 'error');
      alert(`Error loading file: ${err.message}`);
    }
  }

  // 8. Execute test
  async function executeTest(filename) {
    if (isRunning) return;

    isRunning = true;
    btnRunCode.disabled = true;
    btnRunSpinner.classList.remove('hide');
    btnViewReport.classList.add('hide');
    
    // Toggle all run buttons to disabled
    document.querySelectorAll('.action-run').forEach(b => b.disabled = true);
    
    clearTerminal();
    addLogLine(`Starting test run: ${filename}`, 'system');
    addLogLine('Running Playwright tests in headless mode (timeout: 120s)...', 'info');

    try {
      const response = await fetch('/run-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Test execution encountered an error');
      }

      const data = await response.json();
      
      // Print stdout and stderr to terminal
      if (data.stdout) {
        data.stdout.split('\n').forEach(line => {
          if (line.trim()) {
            let type = 'stdout';
            if (line.includes('passed')) type = 'success';
            if (line.includes('failed') || line.includes('Error:')) type = 'error';
            addLogLine(line, type);
          }
        });
      }
      if (data.stderr) {
        data.stderr.split('\n').forEach(line => {
          if (line.trim()) addLogLine(line, 'stderr');
        });
      }

      // Log status
      if (data.status === 'passed') {
        addLogLine(`Test run PASSED (Exit Code: ${data.exit_code})`, 'success');
      } else {
        addLogLine(`Test run FAILED (Exit Code: ${data.exit_code})`, 'error');
      }

      // Show view HTML report button if report is available
      if (data.report_dir) {
        btnViewReport.classList.remove('hide');
        addLogLine('Playwright HTML report is ready.', 'info');
      }

    } catch (err) {
      addLogLine(`Execution failed: ${err.message}`, 'error');
      alert(`Execution failed: ${err.message}`);
    } finally {
      isRunning = false;
      btnRunCode.disabled = false;
      btnRunSpinner.classList.add('hide');
      
      // Re-enable run buttons
      document.querySelectorAll('.action-run').forEach(b => b.disabled = false);
    }
  }

  btnRunCode.addEventListener('click', () => {
    if (currentLoadedScript) {
      executeTest(currentLoadedScript);
    }
  });

  // 9. Copy Code To Clipboard
  btnCopyCode.addEventListener('click', () => {
    navigator.clipboard.writeText(codeDisplay.textContent)
      .then(() => {
        const originalText = btnCopyCode.textContent;
        btnCopyCode.textContent = 'Copied!';
        btnCopyCode.disabled = true;
        setTimeout(() => {
          btnCopyCode.textContent = originalText;
          btnCopyCode.disabled = false;
        }, 1500);
      })
      .catch(err => {
        addLogLine('Failed to copy to clipboard: ' + err.message, 'error');
      });
  });

  // 10. Modal controls for Report
  btnViewReport.addEventListener('click', () => {
    // Open iframe to /report/index.html (where we serve playwright-report)
    reportIframe.src = '/report/index.html';
    reportModal.classList.remove('hide');
  });

  btnCloseModal.addEventListener('click', () => {
    reportModal.classList.add('hide');
    reportIframe.src = 'about:blank';
  });

  // Initialize
  btnClearTerminal.addEventListener('click', clearTerminal);
  btnRefreshSaved.addEventListener('click', fetchSavedTests);
  
  checkServerStatus();
  fetchSavedTests();
});
