/**
 * 任务会话管理器
 * 用于管理多个并行的任务执行会话
 */

class TaskSessionManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> session data
    this.nextSessionId = 1;
  }

  /**
   * 创建新的任务会话
   * @param {Object} command - 要执行的命令
   * @returns {string} sessionId
   */
  createSession(command) {
    const sessionId = `session_${this.nextSessionId++}_${Date.now()}`;

    const session = {
      id: sessionId,
      command: command,
      taskList: [],
      showTaskProgress: false,
      isResultShow: false,
      runResult: [],
      runResultStatus: true,
      currentCommand: command,
      totalDuration: null,
      taskStartTime: null,
      taskEndTime: null,
      isTaskCancelled: false,
      allTasksCompleted: false,
      wasManuallyClosedDuringTask: false,
      floatingButtonPosition: { x: null, y: null },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.sessions.set(sessionId, session);
    console.log('[TaskSessionManager] Created session:', sessionId);

    return sessionId;
  }

  /**
   * 获取会话
   * @param {string} sessionId
   * @returns {Object|null}
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 更新会话
   * @param {string} sessionId
   * @param {Object} updates
   */
  updateSession(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates, { updatedAt: Date.now() });
      console.log('[TaskSessionManager] Updated session:', sessionId);
    }
  }

  /**
   * 删除会话
   * @param {string} sessionId
   */
  deleteSession(sessionId) {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      console.log('[TaskSessionManager] Deleted session:', sessionId);
    }
    return deleted;
  }

  /**
   * 获取所有活跃的会话
   * @returns {Array}
   */
  getActiveSessions() {
    return Array.from(this.sessions.values())
      .filter(session => {
        // 活跃会话：有任务进度信息
        return session.showTaskProgress && session.taskList.length > 0;
      })
      .sort((a, b) => a.createdAt - b.createdAt); // 按创建时间排序
  }

  /**
   * 清理已完成的旧会话（可选）
   * @param {number} maxAge - 最大保留时间（毫秒）
   */
  cleanupOldSessions(maxAge = 3600000) { // 默认1小时
    const now = Date.now();
    const toDelete = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      // 如果会话已完成且超过最大保留时间
      if (session.allTasksCompleted && (now - session.updatedAt) > maxAge) {
        toDelete.push(sessionId);
      }
    }

    toDelete.forEach(sessionId => this.deleteSession(sessionId));

    if (toDelete.length > 0) {
      console.log('[TaskSessionManager] Cleaned up', toDelete.length, 'old sessions');
    }
  }

  /**
   * 获取会话数量
   * @returns {number}
   */
  getSessionCount() {
    return this.sessions.size;
  }

  /**
   * 清空所有会话
   */
  clearAll() {
    this.sessions.clear();
    console.log('[TaskSessionManager] Cleared all sessions');
  }
}

// 创建单例
const taskSessionManager = new TaskSessionManager();

// 定期清理旧会话（每10分钟）
if (typeof window !== 'undefined') {
  setInterval(() => {
    taskSessionManager.cleanupOldSessions();
  }, 600000); // 10分钟
}

export { taskSessionManager, TaskSessionManager };
