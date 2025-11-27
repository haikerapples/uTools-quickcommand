const fs = require("fs");
const path = require("path");
const terminalWindowManager = require("./terminalWindowManager");

// 终端配置
const DEFAULT_TERMINALS = {
  windows: ["wt", "cmd"],
  macos: ["warp", "iterm", "terminal"],
};

// Windows 终端命令生成器
const getWindowsTerminalCommand = (cmdline, options = {}) => {
  const { dir, terminal = "wt", title, reuseWindow = false } = options;
  const appPath = path.join(
    window.utools.getPath("home"),
    "/AppData/Local/Microsoft/WindowsApps/"
  );

  const terminalCommands = {
    wt: () => {
      if (
        fs.existsSync(appPath) &&
        fs.readdirSync(appPath).includes("wt.exe")
      ) {
        const escapedCmd = cmdline.replace(/"/g, `\\"`);
        const cd = dir ? `-d "${dir.replace(/\\/g, "/")}"` : "";
        const titleArg = title ? `--title "${title}"` : "";

        // 检查是否需要复用窗口
        if (reuseWindow) {
          const scriptName = options.scriptName || options.title;
          const windowInfo = terminalWindowManager.getOrCreateWindow('wt', scriptName);

          if (windowInfo.isNew) {
            // 创建新窗口
            return `${appPath}wt.exe ${titleArg} ${cd} cmd /k "${escapedCmd}"`;
          } else {
            // 在现有窗口创建新标签页
            return `${appPath}wt.exe -w 0 new-tab ${titleArg} ${cd} cmd /k "${escapedCmd}"`;
          }
        }

        // 不复用窗口，每次创建新窗口
        return `${appPath}wt.exe ${titleArg} ${cd} cmd /k "${escapedCmd}"`;
      }
      return null;
    },
    cmd: () => {
      const escapedCmd = cmdline.replace(/"/g, `^"`);
      const cd = dir ? `cd /d "${dir.replace(/\\/g, "/")}" &&` : "";
      const windowTitle = title || "QuickCommand Script";
      // CMD不支持标签页复用，始终创建新窗口
      return `${cd} start "${windowTitle}" cmd /k "${escapedCmd}"`;
    },
  };

  // 按优先级尝试不同终端
  const terminalPriority =
    terminal === "default"
      ? DEFAULT_TERMINALS.windows
      : [terminal, ...DEFAULT_TERMINALS.windows];

  for (const term of terminalPriority) {
    const command = terminalCommands[term]?.();
    if (command) return command;
  }

  // 如果都失败了，返回默认的 cmd 命令
  return terminalCommands.cmd();
};

// macOS 终端命令生成器
const getMacTerminalCommand = (cmdline, options = {}) => {
  const { dir, terminal = "warp", title, reuseWindow = false } = options;

  const terminalCommands = {
    warp: () => {
      if (fs.existsSync("/Applications/Warp.app")) {
        const workingDir = dir || process.cwd();
        // 创建临时的 launch configuration
        const configName = `temp_${Date.now()}`;
        const configPath = path.join(
          window.utools.getPath("home"),
          ".warp/launch_configurations",
          `${configName}.yml`
        );

        // 确保目录存在
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }

        // 创建配置文件，对于 Warp，命令不需要转义，因为是通过 YAML 配置传递
        const windowTitle = title || `QuickCommand-${Date.now()}`;
        const config = `---
name: ${configName}
windows:
  - title: "${windowTitle}"
    tabs:
      - title: "${title || 'Script'}"
        layout:
          cwd: "${workingDir}"
          commands:
            - exec: ${cmdline}`;

        fs.writeFileSync(configPath, config);

        // 使用配置文件启动 Warp
        return `open "warp://launch/${configName}" && sleep 0.5 && rm "${configPath}"`;
      }
      return null;
    },
    iterm: () => {
      const escapedCmd = cmdline.replace(/"/g, `\\"`);
      const cd = dir ? `cd ${dir.replace(/ /g, "\\\\ ")} &&` : "";
      if (fs.existsSync("/Applications/iTerm.app")) {
        const windowTitle = title || "QuickCommand Script";

        // 检查是否需要复用窗口
        if (reuseWindow) {
          const scriptName = options.scriptName || options.title;
          const windowInfo = terminalWindowManager.getOrCreateWindow('iterm', scriptName);

          if (windowInfo.isNew) {
            // 创建新窗口
            return `osascript -e 'tell application "iTerm"
              if application "iTerm" is running then
                create window with default profile
              end if
              tell current session of first window
                set name to "${windowTitle}"
                write text "clear && ${cd} ${escapedCmd}"
              end tell
              activate
            end tell'`;
          } else {
            // 在现有窗口创建新标签页
            return `osascript -e 'tell application "iTerm"
              tell first window
                create tab with default profile
                tell current session
                  set name to "${windowTitle}"
                  write text "clear && ${cd} ${escapedCmd}"
                end tell
              end tell
              activate
            end tell'`;
          }
        }

        // 不复用窗口，每次创建新窗口
        return `osascript -e 'tell application "iTerm"
          if application "iTerm" is running then
            create window with default profile
          end if
          tell current session of first window
            set name to "${windowTitle}"
            write text "clear && ${cd} ${escapedCmd}"
          end tell
          activate
        end tell'`;
      }
      return null;
    },
    terminal: () => {
      const escapedCmd = cmdline.replace(/"/g, `\\"`);
      const cd = dir ? `cd ${dir.replace(/ /g, "\\\\ ")} &&` : "";
      const tabTitle = title || "QuickCommand Script";

      // 检查是否需要复用窗口
      if (reuseWindow) {
        const scriptName = options.scriptName || options.title;
        const windowInfo = terminalWindowManager.getOrCreateWindow('terminal', scriptName);
        const windowTitle = windowInfo.windowTitle;

        if (windowInfo.isNew) {
          // 创建新窗口
          return `osascript -e 'tell application "Terminal"
            do script "clear && ${cd} ${escapedCmd}"
            set custom title of front window to "${windowTitle}"
            activate
          end tell'`;
        } else {
          // 在现有窗口创建新标签页（使用System Events）
          return `osascript -e 'tell application "Terminal"
            -- 查找目标窗口
            set targetWindow to missing value
            repeat with w in windows
              try
                if custom title of w is "${windowTitle}" then
                  set targetWindow to w
                  exit repeat
                end if
              on error
                -- 忽略没有自定义标题的窗口
              end try
            end repeat

            if targetWindow is not missing value then
              -- 激活目标窗口
              set index of targetWindow to 1
              activate

              -- 使用System Events创建新标签页
              tell application "System Events"
                tell process "Terminal"
                  keystroke "t" using command down
                end tell
              end tell

              -- 等待新标签页创建完成
              delay 0.3

              -- 在新标签页中执行命令
              do script "clear && ${cd} ${escapedCmd}" in front tab of targetWindow
            else
              -- 如果找不到目标窗口，创建新窗口
              do script "clear && ${cd} ${escapedCmd}"
              set custom title of front window to "${windowTitle}"
            end if
            activate
          end tell'`;
        }
      }

      // 不复用窗口，每次创建新窗口
      const windowTitle = options.scriptName || options.title || title || "QuickCommand Script";
      return `osascript -e 'tell application "Terminal"
        do script "clear && ${cd} ${escapedCmd}"
        set custom title of front window to "${windowTitle}"
        activate
      end tell'`;
    },
  };

  // 按优先级尝试不同终端
  const terminalPriority =
    terminal === "default"
      ? DEFAULT_TERMINALS.macos
      : [terminal, ...DEFAULT_TERMINALS.macos];

  for (const term of terminalPriority) {
    const command = terminalCommands[term]?.();
    if (command) return command;
  }

  // 如果都失败了，返回默认终端命令
  return terminalCommands.terminal();
};

// 主函数
const createTerminalCommand = (cmdline, options = {}) => {
  const { windows = "default", macos = "default" } = options;

  if (window.utools.isWindows()) {
    return getWindowsTerminalCommand(cmdline, {
      ...options,
      terminal: windows,
    });
  } else if (window.utools.isMacOs()) {
    return getMacTerminalCommand(cmdline, { ...options, terminal: macos });
  }

  throw new Error("Unsupported operating system");
};

module.exports = createTerminalCommand;
