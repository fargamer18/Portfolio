document.addEventListener("DOMContentLoaded", async function () {
  const DEBUG = true; // set false to silence verbose logging
  const input = document.getElementById("command-input");
  const output = document.getElementById("terminal-output");
  const suggestion = document.getElementById("autocomplete-suggestion");
  const pathDisplay = document.getElementById("current-path");

  // Base URL (helps when hosted in a subdirectory like GitHub Pages)
  const baseUrl = (window.__BASEURL__ || "/").replace(/\/$/, "");

  let currentPath = "~";

  // Base filesystem with home directory files
  const filesystem = {
    "~": {
      type: "dir",
      children: ["writeups", "projects", "research", "resume.txt", "about.txt", "skills.txt", "contact.txt"]
    },
    "~/writeups": {
      type: "dir",
      children: []
    },
    "~/projects": {
      type: "dir",
      children: []
    },
    "~/research": {
      type: "dir",
      children: []
    },
    "~/resume.txt": {
      type: "file",
      content: [
        "================================================================================",
        "                           MOHAMMED FARAZ KHAN",
        "================================================================================",
        "",
        "Bangalore, India | farazkhanmohammed32@gmail.com | +91 70269 26525",
        "GitHub: github.com/fargamer18",
        "",
        "--------------------------------------------------------------------------------",
        "SUMMARY",
        "--------------------------------------------------------------------------------",
        "Passionate and hands-on Computer Science student with a strong focus on",
        "cybersecurity, systems programming, and applied machine learning. Experienced",
        "in building secure, real-world tools—from encrypted P2P file sharing to",
        "ML-based guidance systems and remote device administration.",
        "",
        "Eager to contribute to innovative teams as an intern in cybersecurity,",
        "software development, or AI/ML roles.",
        "",
        "--------------------------------------------------------------------------------",
        "EDUCATION",
        "--------------------------------------------------------------------------------",
        "B.E. in Computer Science and Engineering",
        "NITTE MEENAKSHI INSTITUTE OF TECHNOLOGY, Bangalore, India",
        "Aug 2022 -- June 2026",
        "",
        "--------------------------------------------------------------------------------",
        "SKILLS",
        "--------------------------------------------------------------------------------",
        "Languages:      Rust, Python, C, C++, Java, Kotlin, JS/TS, Dart, MATLAB",
        "Machine Learning: scikit-learn, TensorFlow, OpenCV, FastAPI, Flask, LLMs, OCR",
        "Frameworks:     Flutter, Next.js, React, Tokio, Axum, Libp2p, Textual (TUI)",
        "Security:       Zero-Trust, X3DH, Double Ratchet, AES/RSA, TLS, GPG",
        "Systems:        Linux (NixOS, Arch), Kernel Modules, Docker, Bash",
        "",
        "--------------------------------------------------------------------------------",
        "PROJECTS (see ~/projects/ for details)",
        "--------------------------------------------------------------------------------",
        "• Zero Trust File Sharing    - Rust, Flutter, Libp2p, AES-256-GCM",
        "• Student Guidance System    - Python, scikit-learn, Flask, JavaScript",
        "• Remote Agent System        - Python, Kotlin, Android SDK, WebSockets, TLS",
        "• Controller Emulator        - Python, Textual, vgamepad, evdev",
        "• NixOS Install Manager      - C, GPG, NixOS",
        "",
        "--------------------------------------------------------------------------------",
        "ADDITIONAL",
        "--------------------------------------------------------------------------------",
        "• Ranked in several CTF competitions; active in cybersecurity community",
        "• Fluent in terminal tools, packet analysis, and OSINT automation",
        "• Currently building tools for BadUSB payload deployment and recon",
        "================================================================================"
      ]
    },
    "~/about.txt": {
      type: "file",
      content: [
        "Mohammed Faraz Khan",
        "Offensive Security Student",
        "B.E. Computer Science @ NITTE Meenakshi Institute of Technology",
        "Focus: Cybersecurity, Systems Programming, AI/ML",
        "",
        "Passionate about building secure, real-world tools.",
        "From encrypted P2P file sharing to ML-based guidance systems.",
        "Currently building tools for BadUSB payload deployment and automated reconnaissance."
      ]
    },
    "~/skills.txt": {
      type: "file",
      content: [
        "Languages: Rust, Python, C, C++, Java, Kotlin, JS/TS, Dart, MATLAB",
        "ML: scikit-learn, TensorFlow, OpenCV, FastAPI, Flask",
        "Frameworks: Flutter, Next.js, React, Tokio, Axum, Libp2p",
        "Security: Zero-Trust, X3DH, Double Ratchet, AES/RSA, TLS, GPG",
        "Systems: Linux (NixOS, Arch), Kernel Modules, Docker, Bash"
      ]
    },
    "~/contact.txt": {
      type: "file",
      content: [
        "Email: farazkhanmohammed32@gmail.com",
        "GitHub: github.com/fargamer18",
        "Phone: +91 70269 26525",
        "Location: Bangalore, India"
      ]
    }
  };

  // Load content dynamically from Hugo-generated JSON
  async function loadDynamicContent() {
    const sections = ['writeups', 'projects', 'research'];
    
    for (const section of sections) {
      try {
        const url = `${baseUrl}/${section}/index.json`;
        DEBUG && console.log('[fetch]', url);
        const response = await fetch(url);
        if (response.ok) {
          const items = await response.json();
          const children = [];
          
          for (const item of items) {
            const fileName = item.name;
            const filePath = `~/${section}/${fileName}`;
            children.push(fileName);
            
            // Add file to filesystem with content as array of lines
            filesystem[filePath] = {
              type: "file",
              content: item.content.split('\n')
            };
          }
          
          // Update directory children
          filesystem[`~/${section}`].children = children;
          DEBUG && console.log(`[fetch:${section}] loaded`, children.length, 'items');
        }
      } catch (e) {
        console.error(`Could not load ${section}:`, e);
      }
    }
  }

  // Load dynamic content on startup
  loadDynamicContent();

  const commands = ["help", "ls", "pwd", "clear", "cd", "neofetch", "cat", "less"];

  function getCurrentDirContents() {
    const dir = filesystem[currentPath];
    return dir && dir.type === "dir" ? dir.children : [];
  }

  const commandHistory = [];
  let historyIndex = -1;

  // Less pager state
  let lessMode = false;
  let lessContent = [];
  let lessScrollPos = 0;
  let lessFileName = "";
  let lessPageSize = 20;
  let lessSearchPattern = "";
  let lessSearchMatches = [];
  let lessSearchIndex = -1;
  let lessSearchMode = null; // null, 'forward', 'backward'
  let lessSearchInput = "";
  let lessIsMarkdown = false;

  document.body.addEventListener("click", function () {
    if (!lessMode) {
      input.focus();
    }
  });

  function resizeInput() {
    input.style.width = Math.max(1, input.value.length) + "ch";
  }

  // Markdown rendering function
  function renderMarkdown(lines) {
    // Normalize input so Markdown regexes behave consistently even with CRLF line endings
    let text = Array.isArray(lines) ? lines.join('\n') : lines;
    text = text.replace(/\r/g, '');
    const container = document.createElement('div');
    container.className = 'markdown-content';
    
    // Strip YAML frontmatter (---...---)
    text = text.replace(/^---\n[\s\S]*?\n---\n?/m, '');
    
    let html = text;
    
    // Process code blocks first (```lang ... ```)
    let codeBlockId = 0;
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(match, lang, code) {
      const id = 'code-block-' + (codeBlockId++);
      const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
      return `<div class="code-block">
        <div class="code-header">
          <span class="code-lang">${lang || 'code'}</span>
          <button class="copy-btn" data-code-id="${id}" onclick="copyCode('${id}')">Copy</button>
        </div>
        <pre id="${id}"><code>${escapedCode}</code></pre>
      </div>`;
    });
    
    // Process inline code (`code`)
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Process images ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="md-image"><img src="$2" alt="$1" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=img-error>[Image not found: $1]</div>\'"><div class="img-caption">$1</div></div>');
    
    // Process links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="md-link">$1</a>');
    
    // Process blockquotes (> text) - must be before headers
    html = html.replace(/^(?:>\s?(.*)(?:\n|$))+/gm, function(match) {
      const lines = match.split('\n').map(l => l.replace(/^>\s?/, '')).join('<br>');
      return '<blockquote class="md-blockquote">' + lines + '</blockquote>';
    });
    
    // Process headers
    html = html.replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>');
    
    // Process strikethrough
    html = html.replace(/~~([^~]+)~~/g, '<del class="md-del">$1</del>');
    
    // Process bold+italic (***text***)
    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    
    // Process bold and italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Process horizontal rules
    html = html.replace(/^---$/gm, '<hr class="md-hr">');
    
    // Process ordered lists (1. 2. 3.)
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="md-oli" value="$1">$2</li>');
    
    // Wrap consecutive ordered list items in <ol>
    html = html.replace(/(<li class="md-oli"[^>]*>.*<\/li>\n?)+/g, '<ol class="md-ol">$&</ol>');
    
    // Process unordered lists (- or *)
    html = html.replace(/^  [-*] (.+)$/gm, '<li class="md-li md-nested">$1</li>');
    html = html.replace(/^[-*] (.+)$/gm, '<li class="md-li">$1</li>');
    
    // Wrap consecutive <li> elements in <ul>
    html = html.replace(/(<li class="md-li[^"]*">.*<\/li>\n?)+/g, '<ul class="md-ul">$&</ul>');
    
    // Process line breaks (preserve blank lines as spacing)
    html = html.replace(/\n\n/g, '</p><p class="md-p">');
    html = '<p class="md-p">' + html + '</p>';
    
    // Clean up empty paragraphs and fix nesting
    html = html.replace(/<p class="md-p"><\/p>/g, '');
    html = html.replace(/<p class="md-p">(<h[1-4])/g, '$1');
    html = html.replace(/(<\/h[1-4]>)<\/p>/g, '$1');
    html = html.replace(/<p class="md-p">(<div class="code-block">)/g, '$1');
    html = html.replace(/(<\/div>)<\/p>/g, '$1');
    html = html.replace(/<p class="md-p">(<ul class="md-ul">)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p class="md-p">(<ol class="md-ol">)/g, '$1');
    html = html.replace(/(<\/ol>)<\/p>/g, '$1');
    html = html.replace(/<p class="md-p">(<hr class="md-hr">)/g, '$1');
    html = html.replace(/(<hr class="md-hr">)<\/p>/g, '$1');
    html = html.replace(/<p class="md-p">(<div class="md-image">)/g, '$1');
    html = html.replace(/<p class="md-p">(<blockquote)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
    
    container.innerHTML = html;
    return container;
  }

  // Global copy function for code blocks
  window.copyCode = function(id) {
    const codeElement = document.getElementById(id);
    if (!codeElement) return;

    const text = codeElement.textContent;

    // Fallback copy for browsers/environments where navigator.clipboard is blocked
    async function doCopy() {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        const btn = document.querySelector(`button[data-code-id="${id}"]`);
        if (btn) {
          const originalText = btn.textContent;
          btn.textContent = '✓ Copied!';
          btn.style.background = '#22c55e';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
          }, 2000);
        }
      } catch (e) {
        console.warn('Copy failed', e);
      }
    }

    doCopy();
  };

  // Less pager functions
  function enterLessMode(content, fileName, isMarkdown = false) {
    DEBUG && console.log('[less] enter', { fileName, isMarkdown, lines: content ? content.length : 0 });
    lessMode = true;
    lessContent = content;
    lessFileName = fileName;
    lessScrollPos = 0;
    lessSearchPattern = "";
    lessSearchMatches = [];
    lessSearchIndex = -1;
    lessSearchMode = null;
    lessSearchInput = "";
    lessIsMarkdown = isMarkdown;
    
    // Hide normal input and blur it
    const promptLine = document.querySelector(".input-line");
    if (promptLine) {
      promptLine.style.display = "none";
    }
    input.blur();
    
    renderLessView();
  }

  function exitLessMode() {
    DEBUG && console.log('[less] exit');
    lessMode = false;
    lessContent = [];
    lessSearchMode = null;
    lessSearchInput = "";
    
    // Remove pager display
    const pager = document.getElementById("less-pager");
    if (pager) pager.remove();
    
    // Show normal input
    const promptLine = document.querySelector(".input-line");
    if (promptLine) {
      promptLine.style.display = "flex";
    }
    input.focus();
  }

  function renderLessView() {
    DEBUG && console.log('[less] render', { isMarkdown: lessIsMarkdown, scrollPos: lessScrollPos, pageSize: lessPageSize, total: lessContent ? lessContent.length : 0 });
    // Remove existing pager if any
    let pager = document.getElementById("less-pager");
    if (pager) pager.remove();
    
    pager = document.createElement("div");
    pager.id = "less-pager";
    pager.style.cssText = "background: #1a1a2e; border: 1px solid #3b82f6; padding: 10px; margin-top: 10px; font-family: inherit;";
    
    // Content area
    const contentArea = document.createElement("div");
    contentArea.id = "less-content";
    
    const totalLines = lessContent.length || 0;
    let startLine = 1;
    let endLine = totalLines;

    if (lessIsMarkdown) {
      // Markdown mode: render full markdown with scroll
      contentArea.style.cssText = "overflow-y: auto; max-height: 60vh; padding-right: 10px;";
      const mdContent = renderMarkdown(lessContent);
      contentArea.appendChild(mdContent);
    } else {
      // Text mode: line-by-line with paging
      contentArea.style.cssText = "white-space: pre; overflow: hidden; height: " + (lessPageSize * 1.4) + "em; line-height: 1.4;";
      
      const endPos = Math.min(lessScrollPos + lessPageSize, lessContent.length);
      startLine = lessScrollPos + 1;
      endLine = endPos;
      for (let i = lessScrollPos; i < endPos; i++) {
        const line = document.createElement("div");
        let lineText = lessContent[i] || "";
        
        // Highlight search matches
        if (lessSearchPattern) {
          try {
            const regex = new RegExp("(" + lessSearchPattern + ")", "gi");
            lineText = lineText.replace(regex, '<span style="background: yellow; color: black;">$1</span>');
            line.innerHTML = lineText;
          } catch (e) {
            line.textContent = lineText;
          }
        } else {
          line.textContent = lineText;
        }
        
        contentArea.appendChild(line);
      }
      
      // Fill remaining space with ~ for empty lines
      for (let i = endPos - lessScrollPos; i < lessPageSize; i++) {
        const line = document.createElement("div");
        line.textContent = "~";
        line.style.color = "#3b82f6";
        contentArea.appendChild(line);
      }
    }
    
    pager.appendChild(contentArea);
    
    // Status bar
    const statusBar = document.createElement("div");
    statusBar.id = "less-status";
    statusBar.style.cssText = "background: #3b82f6; color: #1a1a2e; padding: 2px 5px; margin-top: 5px; font-weight: bold;";
    
    if (lessSearchMode) {
      statusBar.textContent = (lessSearchMode === 'forward' ? '/' : '?') + lessSearchInput;
    } else {
      const percent = lessIsMarkdown
        ? 100
        : (totalLines <= lessPageSize ? 100 : Math.round(((lessScrollPos + lessPageSize) / totalLines) * 100));
      const atEnd = lessIsMarkdown ? true : lessScrollPos + lessPageSize >= totalLines;
      const atStart = lessIsMarkdown ? true : lessScrollPos === 0;
      let posText = "";
      if (atStart && atEnd) posText = "(END)";
      else if (atEnd) posText = "(END)";
      else if (atStart) posText = "(TOP)";
      else posText = percent + "%";
      
      statusBar.textContent = lessFileName + " line " + startLine + "-" + endLine + "/" + totalLines + " " + posText + " (press h for help, q to quit)";
    }
    
    pager.appendChild(statusBar);
    output.appendChild(pager);
    
    // Auto scroll to pager
    pager.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function lessScrollDown(lines) {
    lessScrollPos = Math.min(lessScrollPos + lines, Math.max(0, lessContent.length - lessPageSize));
    renderLessView();
  }

  function lessScrollUp(lines) {
    lessScrollPos = Math.max(0, lessScrollPos - lines);
    renderLessView();
  }

  function lessGoToStart() {
    lessScrollPos = 0;
    renderLessView();
  }

  function lessGoToEnd() {
    lessScrollPos = Math.max(0, lessContent.length - lessPageSize);
    renderLessView();
  }

  function lessFindMatches(pattern, forward) {
    lessSearchMatches = [];
    try {
      const regex = new RegExp(pattern, "i");
      for (let i = 0; i < lessContent.length; i++) {
        if (regex.test(lessContent[i])) {
          lessSearchMatches.push(i);
        }
      }
    } catch (e) {
      // Invalid regex
    }
    lessSearchPattern = pattern;
  }

  function lessSearchNext() {
    if (lessSearchMatches.length === 0) return;
    // Find next match after current scroll position
    for (let i = 0; i < lessSearchMatches.length; i++) {
      if (lessSearchMatches[i] > lessScrollPos) {
        lessScrollPos = lessSearchMatches[i];
        renderLessView();
        return;
      }
    }
    // Wrap around
    lessScrollPos = lessSearchMatches[0];
    renderLessView();
  }

  function lessSearchPrev() {
    if (lessSearchMatches.length === 0) return;
    // Find previous match before current scroll position
    for (let i = lessSearchMatches.length - 1; i >= 0; i--) {
      if (lessSearchMatches[i] < lessScrollPos) {
        lessScrollPos = lessSearchMatches[i];
        renderLessView();
        return;
      }
    }
    // Wrap around
    lessScrollPos = lessSearchMatches[lessSearchMatches.length - 1];
    renderLessView();
  }

  function showLessHelp() {
    const helpContent = [
      "                   LESS HELP",
      "                   ==========",
      "",
      " NAVIGATION:",
      "   j, ↓, Enter     Scroll down one line",
      "   k, ↑            Scroll up one line",
      "   Space, f, PgDn  Scroll down one page",
      "   b, PgUp         Scroll up one page",
      "   g, <            Go to start of file",
      "   G, >            Go to end of file",
      "",
      " SEARCHING:",
      "   /pattern        Search forward",
      "   ?pattern        Search backward",
      "   n               Next match",
      "   N               Previous match",
      "",
      " OTHER:",
      "   h               Show this help",
      "   q               Quit less",
      "",
      "         Press q to exit help"
    ];
    lessContent = helpContent;
    lessFileName = "HELP";
    lessScrollPos = 0;
    renderLessView();
  }

  // Less keydown handler
  function handleLessKeydown(e) {
    if (lessSearchMode) {
      // In search input mode
      if (e.key === "Enter") {
        e.preventDefault();
        lessFindMatches(lessSearchInput, lessSearchMode === 'forward');
        lessSearchMode = null;
        if (lessSearchMatches.length > 0) {
          lessSearchNext();
        } else {
          renderLessView();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        lessSearchMode = null;
        lessSearchInput = "";
        renderLessView();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        lessSearchInput = lessSearchInput.slice(0, -1);
        renderLessView();
      } else if (e.key.length === 1) {
        e.preventDefault();
        lessSearchInput += e.key;
        renderLessView();
      }
      return;
    }

    // Normal less mode
    switch (e.key) {
      case "q":
        e.preventDefault();
        exitLessMode();
        break;
      case "j":
      case "ArrowDown":
      case "Enter":
        e.preventDefault();
        lessScrollDown(1);
        break;
      case "k":
      case "ArrowUp":
        e.preventDefault();
        lessScrollUp(1);
        break;
      case " ":
      case "f":
      case "PageDown":
        e.preventDefault();
        lessScrollDown(lessPageSize);
        break;
      case "b":
      case "PageUp":
        e.preventDefault();
        lessScrollUp(lessPageSize);
        break;
      case "g":
      case "<":
        e.preventDefault();
        lessGoToStart();
        break;
      case "G":
      case ">":
        e.preventDefault();
        lessGoToEnd();
        break;
      case "/":
        e.preventDefault();
        lessSearchMode = 'forward';
        lessSearchInput = "";
        renderLessView();
        break;
      case "?":
        e.preventDefault();
        lessSearchMode = 'backward';
        lessSearchInput = "";
        renderLessView();
        break;
      case "n":
        e.preventDefault();
        lessSearchNext();
        break;
      case "N":
        e.preventDefault();
        lessSearchPrev();
        break;
      case "h":
        e.preventDefault();
        showLessHelp();
        break;
    }
  }

  // Global keydown listener for less mode
  document.addEventListener("keydown", function(e) {
    if (lessMode) {
      handleLessKeydown(e);
    }
  });

  if (input) {
    resizeInput();

    input.addEventListener("keydown", function (e) {
      // Block terminal input while in less mode
      if (lessMode) {
        e.preventDefault();
        return;
      }
      if (e.key === "Enter") {
        const command = input.value.trim();
        if (command) {
          commandHistory.push(command);
          historyIndex = commandHistory.length;
        }
        printPrompt(command);
        handleCommand(command);
        input.value = "";
        updateSuggestion("");
        resizeInput();
      } else if (e.key === "Tab" || (e.key === "ArrowRight" && suggestion.textContent)) {
        if (suggestion.textContent && input.selectionStart === input.value.length) {
          e.preventDefault();
          input.value = input.value + suggestion.textContent;
          updateSuggestion("");
          resizeInput();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (historyIndex > 0) {
          historyIndex--;
          input.value = commandHistory[historyIndex];
          updateSuggestion("");
          resizeInput();
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
          historyIndex++;
          input.value = commandHistory[historyIndex];
          updateSuggestion("");
          resizeInput();
        } else {
          historyIndex = commandHistory.length;
          input.value = "";
          updateSuggestion("");
          resizeInput();
        }
      }
    });

    input.addEventListener("input", function () {
      if (lessMode) {
        input.value = "";
        return;
      }
      updateSuggestion(input.value);
      resizeInput();
    });
  }

  function updateSuggestion(val) {
    if (!val) {
      suggestion.textContent = "";
      return;
    }

    const parts = val.split(" ");
    let match = "";
    const cmd = parts[0].toLowerCase();

    if (parts.length === 1) {
      for (const c of commands) {
        if (c.startsWith(cmd) && c !== cmd) {
          match = c.slice(cmd.length);
          break;
        }
      }
    } else if ((cmd === "cd" || cmd === "cat" || cmd === "less") && parts.length === 2) {
      const target = parts[1];
      const contents = getCurrentDirContents();
      const targets = cmd === "cd"
        ? [...contents.filter(c => !c.endsWith(".txt")), "..", "~"]
        : contents.filter(c => c.endsWith(".txt") || c.endsWith(".md"));
      for (const t of targets) {
        if (t.startsWith(target) && t !== target) {
          match = t.slice(target.length);
          break;
        }
      }
    }

    suggestion.textContent = match;
  }

  function handleCommand(command) {
    const args = command.split(" ");
    const base = args[0].toLowerCase();

    switch (base) {
      case "help":
        printLine("Available commands:");
        printLine("help, ls, pwd, clear, cd [dir], neofetch, cat [file], less [file]");
        break;

      case "pwd":
        printLine(currentPath.replace("~", "/home/lvl999mafiaboss"));
        break;

      case "ls":
        const dir = filesystem[currentPath];
        if (dir && dir.type === "dir" && dir.children.length > 0) {
          printLine(dir.children.join("   "));
        }
        break;

      case "cd":
        const target = args[1];
        if (!target || target === "~") {
          currentPath = "~";
          pathDisplay.textContent = currentPath;
        } else if (target === "..") {
          if (currentPath !== "~") {
            const parts = currentPath.split("/");
            parts.pop();
            currentPath = parts.join("/") || "~";
            pathDisplay.textContent = currentPath;
          }
        } else {
          const newPath = currentPath === "~" ? "~/" + target : currentPath + "/" + target;
          if (filesystem[newPath] && filesystem[newPath].type === "dir") {
            currentPath = newPath;
            pathDisplay.textContent = currentPath;
          } else {
            printLine("cd: no such file or directory: " + target);
          }
        }
        break;

      case "clear":
        output.innerHTML = "";
        break;

      case "neofetch":
        printNeofetch();
        break;

      case "cat":
        if (args[1]) {
          let filePath;
          if (args[1].startsWith("~/")) {
            filePath = args[1];
          } else {
            filePath = currentPath === "~" ? "~/" + args[1] : currentPath + "/" + args[1];
          }
          const file = filesystem[filePath];
          if (file && file.type === "file") {
            // Check if it's a markdown file
            if (args[1].endsWith('.md')) {
              const mdContent = renderMarkdown(file.content);
              output.appendChild(mdContent);
            } else {
              file.content.forEach(line => printLine(line));
            }
          } else {
            printLine("cat: " + args[1] + ": No such file or directory");
          }
        } else {
          printLine("cat: missing operand");
        }
        break;

      case "less":
        if (args[1]) {
          let filePath;
          if (args[1].startsWith("~/")) {
            filePath = args[1];
          } else {
            filePath = currentPath === "~" ? "~/" + args[1] : currentPath + "/" + args[1];
          }
          const file = filesystem[filePath];
          if (file && file.type === "file") {
            const isMarkdown = args[1].endsWith('.md');
            enterLessMode(file.content, args[1], isMarkdown);
          } else {
            printLine("less: " + args[1] + ": No such file or directory");
          }
        } else {
          printLine("less: missing filename");
        }
        break;

      default:
        printLine("Command not found.");
    }
  }

  function printNeofetch() {
    const ascii = [
      "..............                               ",
      "            ..,;:ccc,.                      ",
      "          ......''';lxO.                    ",
      ".....''''..........,:ld;                    ",
      "           .';;;:::;,,.x,                   ",
      "      ..'''.            0Xxoc:,.  ...       ",
      "  ....                ,ONkc;,;cokOdc',.     ",
      " .                   OMo           ':ddo.   ",
      "                    dMc               :OO;  ",
      "                    0M.                 .:o.",
      "                    ;Wd                     ",
      "                     ;XO,                    ",
      "                       ,d0Odlc;,..           ",
      "                           ..',;:cdOOd::,.   ",
      "                                    .:d;.':;.  ",
      "                                       'd,  .'  ",
      "                                         ;l   ..  ",
      "                                          .o      ",
      "                                            c     ",
      "                                            .'    ",
      "                                             .    "
    ];

    const info = [
      { label: "faraz@portfolio", value: "", isTitle: true },
      { label: "---------------", value: "" },
      { label: "Name", value: "Mohammed Faraz Khan" },
      { label: "Location", value: "Bangalore, India" },
      { label: "Education", value: "B.E. Computer Science (2022-2026)" },
      { label: "University", value: "NITTE Meenakshi Institute of Technology" },
      { label: "Focus", value: "Cybersecurity, Systems Programming, AI/ML" },
      { label: "Languages", value: "Rust, Python, C, C++, Java, Kotlin, JS/TS" },
      { label: "Tools", value: "Flutter, React, Docker, Linux, Git" },
      { label: "Security", value: "Zero-Trust, Cryptography, TLS, OSINT" },
      { label: "GitHub", value: "github.com/fargamer18", link: "https://github.com/fargamer18" },
      { label: "Email", value: "farazkhanmohammed32@gmail.com", link: "mailto:farazkhanmohammed32@gmail.com" },
      { label: "", value: "" },
      { label: "", value: "███████████████████████" }
    ];

    const container = document.createElement("div");
    container.className = "neofetch";

    for (let i = 0; i < Math.max(ascii.length, info.length); i++) {
      const row = document.createElement("div");
      row.className = "neofetch-row";

      const artSpan = document.createElement("span");
      artSpan.className = "neofetch-art";
      artSpan.textContent = ascii[i] || "                               ";

      const infoSpan = document.createElement("span");
      infoSpan.className = "neofetch-info";

      if (info[i]) {
        if (info[i].isTitle) {
          infoSpan.innerHTML = `<span class="neofetch-title">${info[i].label}</span>`;
        } else if (info[i].label && info[i].value) {
          if (info[i].link) {
            infoSpan.innerHTML = `<span class="neofetch-label">${info[i].label}</span>: <a href="${info[i].link}" target="_blank">${info[i].value}</a>`;
          } else {
            infoSpan.innerHTML = `<span class="neofetch-label">${info[i].label}</span>: ${info[i].value}`;
          }
        } else {
          infoSpan.textContent = info[i].label || info[i].value;
        }
      }

      row.appendChild(artSpan);
      row.appendChild(infoSpan);
      container.appendChild(row);
    }

    output.appendChild(container);
  }

  function printPrompt(command) {
    const promptDiv = document.createElement("div");
    promptDiv.className = "output-prompt";
    promptDiv.innerHTML = `<span class="box">┌──(</span><span class="user">lvl999mafiaboss㉿portfolio</span><span class="box">)-[</span><span class="path">${currentPath}</span><span class="box">]</span>`;
    output.appendChild(promptDiv);

    const cmdDiv = document.createElement("div");
    cmdDiv.className = "output-command";
    cmdDiv.innerHTML = `<span class="box">└─</span><span class="symbol">$</span>${command}`;
    output.appendChild(cmdDiv);
  }

  function printLine(text) {
    const line = document.createElement("div");
    line.textContent = text;
    output.appendChild(line);
  }
});