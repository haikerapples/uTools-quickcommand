/**
 * 终端窗口管理器
 * 用于管理可视化编排中的终端窗口复用
 */
class TerminalWindowManager {
  constructor() {
    // 存储每个终端类型的窗口信息
    // 格式: { 'iterm': { windowId: 'xxx', tabCount: 1 }, 'terminal': { ... } }
    this.windows = {};
  }

  /**
   * 获取或创建窗口ID
   * @param {string} terminal - 终端类型 (iterm, terminal, warp等)
   * @param {string} scriptName - 脚本名称（可选）
   * @returns {object} - { windowId, windowTitle, isNew, tabCount }
   */
  getOrCreateWindow(terminal, scriptName = null) {
    if (!this.windows[terminal]) {
      // 创建新窗口，使用固定的窗口标识符
      const timestamp = Date.now();
      // 如果有脚本名称，直接使用，否则使用原格式
      const windowTitle = scriptName
        ? scriptName
        : `QuickCommand-${terminal}-${timestamp}`;

      this.windows[terminal] = {
        windowId: `window-${timestamp}`,
        windowTitle: windowTitle,
        tabCount: 1,
        createdAt: timestamp,
      };
      console.log(`[TerminalWindowManager] Created new window for ${terminal}: ${this.windows[terminal].windowTitle}`);
      return {
        windowId: this.windows[terminal].windowId,
        windowTitle: this.windows[terminal].windowTitle,
        isNew: true,
        tabCount: 1,
      };
    }

    // 复用现有窗口，增加标签页计数
    this.windows[terminal].tabCount++;
    console.log(`[TerminalWindowManager] Reusing window for ${terminal}: ${this.windows[terminal].windowTitle} (tab ${this.windows[terminal].tabCount})`);
    return {
      windowId: this.windows[terminal].windowId,
      windowTitle: this.windows[terminal].windowTitle,
      isNew: false,
      tabCount: this.windows[terminal].tabCount,
    };
  }

  /**
   * 清除指定终端的窗口记录
   * @param {string} terminal - 终端类型
   */
  clearWindow(terminal) {
    delete this.windows[terminal];
  }

  /**
   * 清除所有窗口记录
   */
  clearAll() {
    console.log(`[TerminalWindowManager] Clearing all terminal windows`);
    this.windows = {};
  }

  /**
   * 获取窗口信息
   * @param {string} terminal - 终端类型
   * @returns {object|null} - 窗口信息或null
   */
  getWindow(terminal) {
    return this.windows[terminal] || null;
  }

  /**
   * 检查是否存在窗口
   * @param {string} terminal - 终端类型
   * @returns {boolean}
   */
  hasWindow(terminal) {
    return !!this.windows[terminal];
  }
}

// 创建全局单例，确保在整个应用生命周期中只有一个实例
if (!global.terminalWindowManager) {
  global.terminalWindowManager = new TerminalWindowManager();
}

module.exports = global.terminalWindowManager;
