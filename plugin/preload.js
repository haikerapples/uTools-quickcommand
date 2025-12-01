utools.getAppVersion() < "2.6.1" && alert("请升级 uTools 至最新版本");
// -----------------------------------------------------------------
const fs = require("fs");
const os = require("os");
const child_process = require("child_process");
const iconv = require("iconv-lite");
const electron = require("electron");
const path = require("path");
const axios = require("axios");
const http = require("http");
const https = require("https");
const url = require("url");
const crypto = require("crypto");
const DOMPurify = require("dompurify");

require("ses");
const md5 = (input) => {
  return crypto.createHash("md5").update(input, "utf8").digest("hex");
};

window.lodashM = require("./lib/lodashMini");
window.pinyinMatch = require("pinyin-match");
window.DOMPurify = DOMPurify;

const createTerminalCommand = require("./lib/createTerminalCommand");
const terminalWindowManager = require("./lib/terminalWindowManager");
const shortCodes = require("./lib/shortCodes");
const { pluginInfo, getUtoolsPlugins } = require("./lib/getUtoolsPlugins");
const {
  resolveFileToBase64,
  getFileInfo,
  getCurrentFolderPathFix,
  saveFile,
  getSelectFile,
  convertFilePathToUtoolsPayload,
} = require("./lib/utils");
window.pluginInfo = pluginInfo;
window.getUtoolsPlugins = getUtoolsPlugins;
window.resolveFileToBase64 = resolveFileToBase64;
window.getFileInfo = getFileInfo;
window.getCurrentFolderPathFix = getCurrentFolderPathFix;
window.saveFile = saveFile;
window.getSelectFile = getSelectFile;
window.convertFilePathToUtoolsPayload = convertFilePathToUtoolsPayload;

window.getuToolsLite = require("./lib/utoolsLite");
window.quickcommand = require("./lib/quickcommand");
window.quickcomposer = require("./lib/quickcomposer");
window.showUb = require("./lib/showDocs");
window.getQuickcommandTempFile =
  require("./lib/getQuickcommandFile").getQuickcommandTempFile;

// 任务进度窗口服务已移除，改为在组件内部展示

window.getSharedQcById = async (id) => {
  const url = "https://qc.qaz.ink/home/quick/script/getScript";
  const timeStamp = parseInt(new Date().getTime() / 1000);
  const { data } = await axios.get(url, {
    params: {
      id,
    },
    headers: {
      "verify-encrypt": md5("quickcommand666" + timeStamp),
      "verify-time": timeStamp,
    },
  });
  return JSON.stringify(data.data);
};

// 检测进程是否存在
let isProcessExits = (pid) => {
  try {
    return process.kill(pid, 0);
  } catch (e) {
    return false;
  }
};

window.isAppVersion4 = () => utools.getAppVersion() >= "4.0.0";

// 多开检测
window.multiProcessDetection = () => {
  let pids = JSON.parse(localStorage.getItem("processes")) || [];
  if (pids.length) pids = pids.filter((x) => isProcessExits(x));
  pids.push(process.pid);
  localStorage.setItem("processes", JSON.stringify(pids));
  if (pids.length > 1) return true;
  return false;
};

/**
 * 忘了为什么之前注释下面的语句了 -_-!，保留浏览器的 axios
 * axios.defaults.adapter = require('axios/lib/adapters/http')
 * 另外创建一个 node 的 axios
 */
const nodeAxios = axios.create({
  httpAgent: new http.Agent(),
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
});
nodeAxios.defaults.adapter = "http";

if (!window.utools.isWindows())
  process.env.PATH = `/usr/local/bin:/usr/local/sbin:${process.env.PATH}`;

if (window.utools.isMacOS())
  process.env.PATH = `/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH}`;

window.htmlEncode = (value) => {
  let dom = quickcommand.htmlParse().querySelector("body");
  dom.innerText = value;
  return dom.innerHTML;
};

window.removeHtmlTags = (value) => {
  return quickcommand.htmlParse(value).querySelector("body").innerText;
};

window.hexEncode = (text) => Buffer.from(text, "utf8").toString("hex");
window.hexDecode = (text) => Buffer.from(text, "hex").toString("utf8");
window.base64Decode = (text) => Buffer.from(text, "base64").toString("utf8");

window.processPlatform = process.platform;
window.joinPath = path.join;

window.clipboardReadText = () => electron.clipboard.readText();

let getSandboxFuns = () => {
  var sandbox = {
    fetch: fetch.bind(window),
    utools: window.getuToolsLite(),
    electron,
    axios: nodeAxios,
    Audio,
    AbortController,
    AbortSignal,
    Buffer,
    require,
    // 兼容老版本
    fs,
    path,
    os,
    child_process,
    quickcomposer,
    // timeout
    setTimeout: quickcommand.setTimeout,
    clearTimeout: quickcommand.clearTimeout,
  };
  Object.keys(shortCodes).forEach((f) => {
    sandbox[f] = shortCodes[f];
  });
  return sandbox;
};

// 简化报错信息
let liteErr = (e) => {
  if (!e) return;
  if (typeof e === "string") return e;
  return e.error
    ? e.error.stack.replace(/([ ] +at.+)|(.+\.js:\d+)/g, "").trim()
    : e.message;
};

// vm 模块将无法在渲染进程中使用，改用 ses 来执行代码
window.evalCodeInSandbox = (code, addVars = {}) => {
  let sandboxWithAD = Object.assign(addVars, getSandboxFuns());
  // 使用完整的window.quickcommand（包含Vue组件添加的runCode函数）
  // 注意：window.quickcommand可能已经被Vue组件扩展，包含runCode函数
  sandboxWithAD.quickcommand = window.quickcommand;
  try {
    return new Compartment(sandboxWithAD).evaluate(code);
  } catch (error) {
    throw liteErr(error);
  }
};

let isWatchingError = false;
window.runCodeInSandbox = (code, callback, addVars = {}) => {
  let sandbox = getSandboxFuns();
  let hasAsyncOperations = false;
  let pendingCallbacks = 0;
  let finalCallbackCalled = false;

  // 包装回调函数，确保只调用一次
  let finalCallback = (stdout, stderr) => {
    if (!finalCallbackCalled) {
      finalCallbackCalled = true;
      callback(stdout, stderr);
    }
  };

  // 保存原始函数引用


  // 使用完整的window.quickcommand（包含Vue组件添加的runCode函数）
  // 注意：window.quickcommand可能已经被Vue组件扩展，包含runCode函数
  sandbox.quickcommand = window.quickcommand;

// 检查异步操作是否完成
  let checkAsyncComplete = () => {
    if (hasAsyncOperations && pendingCallbacks <= 0 && !finalCallbackCalled) {
      console.log('[runCodeInSandbox] All async operations completed, calling manual cleanup');
      // 延迟清理拦截器，确保所有UI更新完成
      setTimeout(() => {
        manualCleanup();
        // 然后调用原始回调通知完成
        finalCallback(null, null);
      }, 100);
    }
  };

// 清理函数
  let cleanup = () => {
    console.log('[runCodeInSandbox] Cleaning up...');
    // 不再需要恢复全局拦截器，因为每个沙箱实例使用自己的拦截器
  };

  // 包装finalCallback，确保每次调用都执行清理
  let wrappedFinalCallback = (result, error) => {
    if (!finalCallbackCalled) {
      finalCallbackCalled = true;
      cleanup();
      finalCallback(result, error);
    }
  };

  // 检查是否应该立即清理（仅用于同步代码的情况）
  let shouldCleanupImmediately = false;

  // 用于手动清理的函数（在异步操作真正完成时调用）
  let manualCleanup = () => {
    if (!finalCallbackCalled) {
      console.log('[runCodeInSandbox] Manual cleanup triggered...');
      cleanup();
    }
  };

sandbox.console = {
    log: (...stdout) => {
      console.log("Result:", stdout);
      // 在异步模式下，不立即调用wrappedFinalCallback，让异步操作自然完成
      if (!hasAsyncOperations) {
        wrappedFinalCallback(stdout, null);
      }
    },
    error: (...stderr) => {
      if (!hasAsyncOperations) {
        wrappedFinalCallback(null, stderr);
      } else {
        console.error("Sandbox error:", stderr);
      }
    },
    clear: () => {
      if (!hasAsyncOperations) {
        wrappedFinalCallback({ __clearQuickcommandRunResult: true }, null);
      }
    },
  };

let sandboxWithAD = Object.assign(addVars, sandbox);
  // 使用完整的window.quickcommand（包含Vue组件添加的runCode函数）
  sandboxWithAD.quickcommand = window.quickcommand;

  // 获取sessionId（如果有的话）
  const sessionId = addVars.__sessionId;

  // 根据sessionId创建会话专属的函数包装器
  if (sessionId) {
    console.log('[runCodeInSandbox] Creating session-specific wrappers for:', sessionId);

    // 为__isTaskCancelled创建会话专属包装器
    const sessionIsTaskCancelled = window[`__isTaskCancelled_${sessionId}`];
    if (sessionIsTaskCancelled) {
      sandboxWithAD.__isTaskCancelled = sessionIsTaskCancelled;
    } else {
      sandboxWithAD.__isTaskCancelled = () => false;
    }

    // 为__updateTaskProgress创建会话专属包装器
    const sessionUpdateTaskProgress = window[`__updateTaskProgress_${sessionId}`];
    if (sessionUpdateTaskProgress) {
      // 创建一个包装函数，同时处理异步跟踪和UI更新
      sandboxWithAD.__updateTaskProgress = (taskId, status, error) => {
        // 跟踪任务状态（用于异步操作检测）
        if (status === 'running') {
          pendingCallbacks++;
          hasAsyncOperations = true;
          console.log('[runCodeInSandbox] Task started for session:', sessionId, 'pendingCallbacks:', pendingCallbacks);
        } else if (status === 'success' || status === 'error' || status === 'cancelled') {
          if (pendingCallbacks > 0) {
            pendingCallbacks--;
          }
          console.log('[runCodeInSandbox] Task completed for session:', sessionId, 'pendingCallbacks:', pendingCallbacks);
          checkAsyncComplete();
        }

        // 调用会话专属函数更新UI
        sessionUpdateTaskProgress(taskId, status, error);
      };
    } else {
      // 如果没有会话专属函数，使用拦截器
      sandboxWithAD.__updateTaskProgress = window.__updateTaskProgress;
    }

    // 为__cancelTaskExecution创建会话专属包装器
    const sessionCancelTaskExecution = window[`__cancelTaskExecution_${sessionId}`];
    if (sessionCancelTaskExecution) {
      sandboxWithAD.__cancelTaskExecution = sessionCancelTaskExecution;
    } else {
      sandboxWithAD.__cancelTaskExecution = () => {};
    }
  } else {
    // 没有sessionId时，使用拦截器和全局函数
    sandboxWithAD.__updateTaskProgress = window.__updateTaskProgress;
    sandboxWithAD.__isTaskCancelled = window.__isTaskCancelled || (() => false);
    sandboxWithAD.__cancelTaskExecution = window.__cancelTaskExecution || (() => {});
  }

  console.log('[runCodeInSandbox] Injected session-specific functions into sandbox');

  // 调试：检查quickcommand.runCode是否存在
  console.log('[runCodeInSandbox] window.quickcommand:', window.quickcommand);
  console.log('[runCodeInSandbox] window.quickcommand.runCode:', window.quickcommand?.runCode);
  if (addVars.enterData) {
    sandboxWithAD.quickcommand.enterData = addVars.enterData;
    sandboxWithAD.quickcommand.payload = addVars.enterData.payload;
  }

// 直接检测代码是否包含异步模式，而不依赖运行时包装
  // 对于quickcomposer生成的代码，如果有async函数或await调用，就认为是异步操作
  const hasAsyncKeywords = code.includes('async function') ||
                           code.includes('await ') ||
                           code.includes('quickcommand.runCode');

  if (hasAsyncKeywords) {
    console.log('[runCodeInSandbox] Async operations detected in code (keywords: async/await/quickcommand.runCode)');
    hasAsyncOperations = true;
  } else {
    console.log('[runCodeInSandbox] No async keywords detected in code');
  }

try {
    const result = new Compartment(sandboxWithAD).evaluate(code);

    // 代码执行后，首先检查evaluate的返回结果是否是Promise
    if (hasAsyncOperations) {
      // 首先检查evaluate的返回结果是否是Promise
if (result && typeof result.then === 'function') {
        console.log('[runCodeInSandbox] Got Promise from evaluate(), waiting for completion...');
        console.log('[runCodeInSandbox] Promise object:', result);
result.then(
          (value) => {
            console.log('[runCodeInSandbox] Promise resolved with:', value);
            if (!finalCallbackCalled) {
              manualCleanup(); // 异步操作完成后手动清理
              finalCallbackCalled = true;
              finalCallback(value, null);
            }
          },
          (error) => {
            console.log('[runCodeInSandbox] Promise rejected with:', error);
            console.log('[runCodeInSandbox] Promise rejection stack:', error?.stack);
            if (!finalCallbackCalled) {
              manualCleanup(); // 异步操作完成后手动清理
              finalCallbackCalled = true;
              finalCallback(null, error);
            }
          }
        );

        // 添加超时保护，防止Promise永远不resolve
        setTimeout(() => {
          if (!finalCallbackCalled) {
            console.log('[runCodeInSandbox] Promise timeout after 60 seconds, forcing callback');
            wrappedFinalCallback(null, new Error('Promise timeout'));
          }
        }, 60000);
      } else if (sandboxWithAD.globalThis && sandboxWithAD.globalThis.main) {
        // 如果evaluate结果不是Promise，检查是否有main函数需要调用
        const mainFunc = sandboxWithAD.globalThis.main;
        if (typeof mainFunc === 'function') {
          console.log('[runCodeInSandbox] Found main function, calling it to capture Promise...');
          try {
            const promiseResult = mainFunc();
            // 如果返回Promise，等待其完成
            if (promiseResult && typeof promiseResult.then === 'function') {
              console.log('[runCodeInSandbox] Got Promise from main(), waiting for completion...');
promiseResult.then(
                (value) => {
                  console.log('[runCodeInSandbox] Promise resolved with:', value);
                  if (!finalCallbackCalled) {
                    manualCleanup(); // 异步操作完成后手动清理
                    finalCallbackCalled = true;
                    finalCallback(value, null);
                  }
                },
                (error) => {
                  console.log('[runCodeInSandbox] Promise rejected with:', error);
                  if (!finalCallbackCalled) {
                    manualCleanup(); // 异步操作完成后手动清理
                    finalCallbackCalled = true;
                    finalCallback(null, error);
                  }
                }
              );
} else {
              // 没有返回Promise，手动清理
              console.log('[runCodeInSandbox] main() did not return Promise, performing manual cleanup');
              setTimeout(() => {
                if (!finalCallbackCalled) {
                  manualCleanup(); // 手动清理
                  finalCallbackCalled = true;
                  finalCallback(promiseResult, null);
                }
              }, 200);
            }
} catch (mainError) {
            console.log('[runCodeInSandbox] Error calling main():', mainError);
            if (!finalCallbackCalled) {
              wrappedFinalCallback(null, mainError);
            }
          }
} else {
          console.log('[runCodeInSandbox] main is not a function, performing manual cleanup');
          setTimeout(() => {
            if (!finalCallbackCalled) {
              manualCleanup(); // 手动清理
              finalCallbackCalled = true;
              finalCallback(result, null);
            }
          }, 200);
        }
      } else {
// 异步代码但没有Promise或main函数，使用超时机制
        console.log('[runCodeInSandbox] Async code detected but no Promise or main function found, using fallback timeout');
        setTimeout(() => {
          if (!finalCallbackCalled) {
            manualCleanup(); // 超时时手动清理
            finalCallbackCalled = true;
            finalCallback(result, null);
          }
        }, 30000); // 30秒超时
      }
} else {
      // 同步代码，立即清理并延迟回调
      console.log('[runCodeInSandbox] Synchronous code, performing immediate cleanup');
      cleanup(); // 同步代码立即清理
      setTimeout(() => {
        if (!finalCallbackCalled) {
          finalCallbackCalled = true;
          finalCallback(result, null);
        }
      }, 200);
    }

// 异步处理已在上面完成
  } catch (e) {
    console.log("Error: ", e);
    wrappedFinalCallback(null, liteErr(e));
  }

  // 自动捕捉错误
  let cbUnhandledError = (e) => {
    removeAllListener();
    console.log("UnhandledError: ", e);
    wrappedFinalCallback(null, liteErr(e));
  };

  let cbUnhandledRejection = (e) => {
    removeAllListener();
    console.log("UnhandledRejection: ", e);
    wrappedFinalCallback(null, liteErr(e.reason));
  };

  let removeAllListener = () => {
    window.removeEventListener("error", cbUnhandledError);
    window.removeEventListener("unhandledrejection", cbUnhandledRejection);
    isWatchingError = false;
  };

  if (!isWatchingError) {
    window.addEventListener("error", cbUnhandledError);
    window.addEventListener("unhandledrejection", cbUnhandledRejection);
    isWatchingError = true;
  }
};

// 构建命令行字符串的工具函数
const buildCommandLine = (bin, argv, script, scptarg) => {
  if (bin.slice(-7) === "csc.exe") {
    const outFile = script.slice(0, -2) + "exe";
    return `${bin} ${argv} /out:"${outFile}" "${script}" && "${outFile}" ${scptarg}`;
  }

  if (bin === "gcc") {
    const suffix = utools.isWindows() ? ".exe" : "";
    const outFile = script.slice(0, -2) + suffix;
    return `${bin} ${argv} "${script.slice(
      0,
      -2
    )}" "${script}" && "${outFile}" ${scptarg}`;
  }

  if (utools.isWindows() && bin === "bash") {
    const wslPath = script.replace(/\\/g, "/").replace(/C:/i, "/mnt/c");
    return `wsl -e ${bin} ${argv} "${wslPath}" ${scptarg}`;
  }

  return `${bin} ${argv} "${script}" ${scptarg}`;
};

// 处理进程输出的工具函数
const handleProcessOutput = (child, charset, callback, realTime) => {
  const chunks = [];
  const errChunks = [];

  child.stdout.on("data", (chunk) => {
    const decodedChunk = charset.outputCode
      ? iconv.decode(chunk, charset.outputCode)
      : chunk;
    realTime
      ? callback(decodedChunk.toString(), null)
      : chunks.push(decodedChunk);
  });

  child.stderr.on("data", (errChunk) => {
    const decodedChunk = charset.outputCode
      ? iconv.decode(errChunk, charset.outputCode)
      : errChunk;
    realTime
      ? callback(null, decodedChunk.toString())
      : errChunks.push(decodedChunk);
  });

  if (!realTime) {
    child.on("close", () => {
      callback(chunks.join(""), errChunks.join(""));
    });
  }
};

// 等待信号文件的辅助函数
window.waitForSignalFile = (signalFilePath, timeout = 300000) => {
  console.log('[waitForSignalFile] Waiting for signal file:', signalFilePath);
  console.log('[waitForSignalFile] Temp directory:', utools.getPath('temp'));
  console.log('[waitForSignalFile] File exists at start:', fs.existsSync(signalFilePath));

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkInterval = 500; // 每500ms检查一次

    const checkFile = () => {
      const elapsed = Date.now() - startTime;
      if (fs.existsSync(signalFilePath)) {
        console.log(`[waitForSignalFile] Signal file found after ${elapsed}ms!`);
        // 文件存在，删除它并resolve
        try {
          fs.unlinkSync(signalFilePath);
          console.log('[waitForSignalFile] Signal file deleted successfully');
          resolve(true);
        } catch (err) {
          console.error('删除信号文件失败:', err);
          resolve(true); // 即使删除失败也继续
        }
      } else if (elapsed > timeout) {
        // 超时
        console.error(`[waitForSignalFile] Timeout after ${timeout}ms, file never created`);
        console.log('[waitForSignalFile] Temp directory contents:', fs.readdirSync(utools.getPath('temp')));
        reject(new Error(`等待脚本执行完成超时（${timeout}ms）`));
      } else {
        // 继续等待
        if (elapsed % 5000 < 500) { // 每5秒输出一次进度
          console.log(`[waitForSignalFile] Still waiting... ${elapsed}ms elapsed`);
        }
        setTimeout(checkFile, checkInterval);
      }
    };

    checkFile();
  });
};

// 生成唯一的信号文件路径
window.generateSignalFilePath = () => {
  const tempDir = utools.getPath('temp');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const signalPath = path.join(tempDir, `quickcommand_signal_${timestamp}_${random}.txt`);
  console.log('[generateSignalFilePath] Generated path:', signalPath);
  console.log('[generateSignalFilePath] Temp directory:', tempDir);
  return signalPath;
};

// 清除终端窗口管理器
window.clearTerminalWindows = () => {
  terminalWindowManager.clearAll();
  console.log('终端窗口管理器已清除');
};

window.runCodeFile = (
  cmd,
  option,
  terminalOptions,
  callback,
  realTime = true
) => {
  const { bin, argv, ext, charset, scptarg, envPath, alias } = option;
  // 为每个脚本生成唯一的文件名，避免并发执行时文件被覆盖
  const uniqueName = `quickcommandTempScript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const script = getQuickcommandTempFile(ext, uniqueName);

  // 处理编码和换行
  // 只在 Windows 系统上或特定语言（cmd、bat、powershell）时才转换为 CRLF
  const needsCRLF = utools.isWindows() || ['.bat', '.cmd', '.ps1'].includes(ext);
  const normalizedCmd = needsCRLF ? cmd.replace(/\n/g, "\r\n") : cmd;
  const processedCmd = charset.scriptCode
    ? iconv.encode(normalizedCmd, charset.scriptCode)
    : normalizedCmd;
  fs.writeFileSync(script, processedCmd);
  // 构建命令行
  let cmdline = buildCommandLine(bin, argv, script, scptarg);

  // 处理环境变量
  const processEnv = window.lodashM.cloneDeep(process.env);
  if (envPath) processEnv.PATH = envPath;
  if (alias) {
    const lineBreak = utools.isWindows() ? '\r\n' : '\n';
    cmdline = `${alias}${lineBreak}${cmdline}`;
  }
  if (!!terminalOptions) {
    cmdline = createTerminalCommand(cmdline, terminalOptions);
  }

  // 创建子进程
  const child = child_process.spawn(cmdline, {
    encoding: "buffer",
    shell: true,
    env: processEnv,
  });

  console.log("Running: " + cmdline);
  handleProcessOutput(child, charset, callback, realTime);
  return child;
};

const dbStorage = utools.dbStorage;
let httpServer;
window.quickcommandHttpServer = () => {
  let run = (port = 33442) => {
    let httpResponse = (res, code, result) => {
      // 只收受一次 console.log，接收后就关闭连接
      if (res.finished) return;
      res.writeHead(code, {
        "Content-Type": "text/html",
      });
      if (result) res.write(result);
      res.end();
    };
    let runUserCode = (res, userVars) => {
      let cmd = dbStorage.getItem("cfg_serverCode");
      // 不需要返回输出的提前关闭连接
      if (!cmd.includes("console.log")) httpResponse(res, 200);
      window.runCodeInSandbox(
        cmd,
        (stdout, stderr) => {
          // 错误返回 500
          if (stderr) return httpResponse(res, 500, stderr.join(" "));
          return httpResponse(res, 200, stdout.join(" "));
        },
        userVars
      );
    };
    httpServer = http.createServer();
    httpServer.on("request", (req, res) => {
      if (req.method === "GET") {
        let parsedParams = window.lodashM.cloneDeep(
          url.parse(req.url, true).query
        );
        runUserCode(res, parsedParams);
      } else if (req.method === "POST") {
        let data = [];
        req.on("data", (chunk) => {
          data.push(chunk);
        });
        req.on("end", () => {
          let parsedParams;
          let params = data.join("").toString();
          // 先尝试作为 json 解析
          try {
            parsedParams = JSON.parse(params);
          } catch (error) {
            parsedParams = window.lodashM.cloneDeep(
              url.parse("?" + params, true).query
            );
          }
          runUserCode(res, parsedParams);
        });
      } else {
        httpResponse(res, 405);
      }
    });
    httpServer.listen(port, "localhost");
    httpServer.on("error", (err) => {
      utools.showNotification("快捷命令服务:", err);
    });
  };
  let stop = () => {
    if (!httpServer) return;
    httpServer.close();
  };
  return {
    run,
    stop,
  };
};
