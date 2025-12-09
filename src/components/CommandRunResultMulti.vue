<template>
  <div>
    <!-- 渲染所有活跃的任务会话 -->
    <div
      v-for="session in activeSessions"
      :key="session.id"
    >
      <!-- 对话框 -->
      <q-dialog
        v-model="session.isResultShow"
        :position="fromUtools ? 'top' : 'bottom'"
        @hide="() => stopRun(session.id)"
        :maximized="fromUtools"
        :transition-duration="fromUtools ? 0 : 200"
      >
        <q-card
          :style="{
            maxWidth: fromUtools ? '100%' : 'min(90vw, 700px)',
            width: fromUtools ? '100%' : 'min(90vw, 700px)',
            overflow: 'hidden',
          }"
          class="command-run-result"
        >
          <div
            v-if="!(enableHtml && fromUtools)"
            :style="{
              height: headerHeight + 'px',
            }"
            class="flex items-center justify-between"
          >
            <div>
              <q-avatar :size="`${headerHeight}`">
                <q-icon
                  :class="session.runResultStatus ? 'text-green' : 'text-red'"
                  :name="session.runResultStatus ? 'task_alt' : 'error'"
                  size="sm"
                ></q-icon>
              </q-avatar>
              <span class="text-weight-bold text-h7">运行结果</span>
              <q-chip
                v-if="getSessionProgramInfo(session) && session.currentCommand && session.currentCommand.program !== 'quickcomposer'"
                :color="getSessionProgramInfo(session).color"
                text-color="white"
                size="sm"
                class="q-ml-sm"
              >
                {{ getSessionProgramInfo(session).shortName || getSessionProgramInfo(session).name }}
              </q-chip>
              <!-- 可视化编排名称和时间 -->
              <span v-if="session.currentCommand && session.currentCommand.program === 'quickcomposer'" class="q-ml-sm">
                <span class="text-caption q-ml-xs" style="font-size: 15px">{{ "任务名称：" }}</span>
                <span class="text-weight-bold" style="font-size: 17px;color: #e74c3c">{{ getSessionCommandName(session) }}</span>
                <span class="text-caption q-ml-xs" style="font-size: 15px">{{ " | 启动时间：" }}</span>
                <span class="text-caption q-ml-xs" style="font-size: 15px; color: #8b8b8b">{{ formatSessionStartTime(session) }}</span>
              </span>
            </div>
            <ResultMenu
              class="no-shadow q-pa-sm"
              :stretch="true"
              :runResult="session.runResult"
              :closebtn="!fromUtools"
              :textbtn="!enableHtml"
              :imagebtn="!enableHtml && isDataUrl(session.runResult)"
              @showImg="(imgs) => showBase64Img(session.id, imgs)"
              @updateResult="(result) => updateSessionResult(session.id, result)"
              :style="{
                height: headerHeight + 'px',
              }"
            />
          </div>
          <div
            :style="{ maxHeight: maxHeight - headerHeight + 'px' }"
            class="scroll"
          >
            <!-- 任务进度列表 -->
            <div v-if="session.showTaskProgress && session.taskList.length > 0" class="q-pa-md">
              <div class="text-h6 q-mb-md flex items-center justify-between">
                <span>任务执行进度</span>
                <div class="flex items-center q-gutter-sm">
                  <q-chip
                    v-if="session.totalDuration !== null"
                    color="primary"
                    text-color="white"
                    size="sm"
                    class="total-duration-chip"
                  >
                    <q-icon name="timer" size="xs" class="q-mr-xs" />
                    总耗时: {{ formatDuration(session.totalDuration) }}
                  </q-chip>
                  <q-btn
                    v-if="isSessionTaskRunning(session) && !session.isTaskCancelled"
                    @click="() => cancelTasks(session.id)"
                    color="negative"
                    size="sm"
                    icon="stop"
                    label="终止"
                    dense
                    unelevated
                  />
                  <q-btn
                    v-if="isSessionAllTasksFinished(session) && session.currentCommand"
                    @click="() => restartTasks(session.id)"
                    color="primary"
                    size="sm"
                    icon="refresh"
                    label="重新开始"
                    dense
                    unelevated
                  />
                </div>
              </div>
              <q-list bordered separator>
                <q-item v-for="task in session.taskList" :key="task.id" class="task-item">
                  <q-item-section avatar>
                    <q-icon
                      :name="
                        task.status === 'success'
                          ? 'check_circle'
                          : task.status === 'error'
                          ? 'error'
                          : task.status === 'cancelled'
                          ? 'block'
                          : task.status === 'running'
                          ? 'pending'
                          : 'radio_button_unchecked'
                      "
                      :color="
                        task.status === 'success'
                          ? 'positive'
                          : task.status === 'error'
                          ? 'negative'
                          : task.status === 'cancelled'
                          ? 'grey-7'
                          : task.status === 'running'
                          ? 'primary'
                          : 'grey'
                      "
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="task-title-row">
                      <q-chip
                        v-if="task.programInfo"
                        :color="task.programInfo.color"
                        text-color="white"
                        size="sm"
                        class="task-program-chip"
                      >
                        {{ task.programInfo.shortName || task.programInfo.name }}
                      </q-chip>
                      <span class="task-original-title">{{ task.originalLabel }}</span>
                    </q-item-label>
                    <q-item-label v-if="task.customTitle" class="task-custom-title">
                      {{ task.customTitle }}
                    </q-item-label>
                    <q-item-label v-if="task.desc" caption class="task-desc">
                      {{ task.desc }}
                    </q-item-label>
                    <q-item-label v-if="task.duration !== null || (task.status === 'running' && task.startTime)" caption class="task-duration">
                      <q-icon name="schedule" size="xs" class="q-mr-xs" />
                      {{ task.duration !== null ? formatDuration(task.duration) : formatDuration(getCurrentRunningTime(task)) }}
                      <span v-if="task.status === 'running'" class="running-indicator">...</span>
                    </q-item-label>
                    <q-item-label v-if="task.error" caption class="text-negative task-error">
                      <q-icon name="error" size="xs" class="q-mr-xs" />
                      {{ task.error }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>
            <!-- 结果区域 -->
            <ResultArea
              v-if="!session.showTaskProgress"
              @frameLoad="frameLoad"
              :frameInitHeight="frameInitHeight"
              :enableHtml="enableHtml"
              :runResultStatus="session.runResultStatus"
              :runResult="session.runResult"
              :key="session.id + '_' + timeStamp"
              @mouseup="selectHandler"
            />
            <q-resize-observer @resize="autoHeight" debounce="0" />
          </div>
          <q-menu v-if="selectText" touch-position @before-hide="clearSelect">
            <ResultMenu :dense="true" :selectText="selectText" :textbtn="true" />
          </q-menu>
        </q-card>
      </q-dialog>

      <!-- 浮动按钮 -->
      <div
        v-if="shouldShowFloatingButton(session)"
        :style="getFloatingButtonStyle(session)"
        style="position: fixed; z-index: 9999;"
      >
        <q-btn
          fab
          :color="getFloatingButtonColor(session)"
          icon="visibility"
          @mousedown="(e) => startDragOrLongPress(e, session.id)"
          @click="() => handleFloatingButtonClick(session.id)"
          class="floating-task-button"
        >
          <q-badge
            v-if="session.taskList.length > 0"
            color="red"
            floating
            :label="getSessionTaskSummary(session)"
          />
          <q-tooltip>
            {{ getFloatingButtonTooltip(session.id) }}
          </q-tooltip>
        </q-btn>
      </div>
    </div>
  </div>
</template>

<script>
import { taskSessionManager } from "js/taskSessionManager.js";
import outputTypes from "js/options/outputTypes.js";
import specialVars from "js/options/specialVars.js";
import commandTypes from "js/options/commandTypes.js";
import ResultArea from "components/ResultArea.vue";
import ResultMenu from "components/popup/ResultMenu.vue";
import { generateFlowsCode } from "js/composer/generateCode";
import { dbManager } from "js/utools.js";
import programs from "js/options/programs.js";
import { useCommandManager } from "js/commandManager.js";
import { findCommandByValue } from "js/composer/composerConfig";

export default {
  components: { ResultArea, ResultMenu },
  setup() {
    const commandManager = useCommandManager();
    return { commandManager };
  },
  data() {
    return {
      selectText: null,
      enableHtml: false,
      frameInitHeight: 0,
      childProcess: null,
      timeStamp: null,
      urlReg:
        /^((ht|f)tps?):\/\/([\w\-]+(\.[\w\-]+)*\/)*[\w\-]+(\.[\w\-]+)*\/?(\?([\w\-\.,@?^=%&:\/~\+#]*)+)?/,
      realTimeUpdateTimer: null,
      // 拖动状态管理（按sessionId）
      draggingStates: new Map(), // sessionId -> { isDragging, dragStartPos, dragStartMousePos, hasMoved }
      // 活跃的会话列表（响应式）
      activeSessions: [],
      // 长按关闭状态管理（按sessionId）
      longPressStates: new Map(), // sessionId -> { timer, startTime }
      longPressDuration: 800, // 长按时长（毫秒）
    };
  },
  computed: {
    fromUtools() {
      return this.$route.name === "command";
    },
    needTempPayload() {
      return !["command", "code", "composer"].includes(this.$route.name);
    },
    maxHeight() {
      return this.fromUtools ? Math.min(window.innerHeight * 0.9, 600) : Math.min(window.innerHeight * 0.7, 400);
    },
    headerHeight() {
      return this.enableHtml && this.fromUtools ? 0 : 40;
    },
  },
  methods: {
    /**
     * 刷新活跃会话列表
     */
    refreshActiveSessions() {
      this.activeSessions = taskSessionManager.getActiveSessions();
      console.log('[CommandRunResultMulti] Active sessions refreshed:', this.activeSessions.length);
    },

    /**
     * 运行命令（创建新会话）
     */
    async runCurrentCommand(currentCommand) {
      console.log('[CommandRunResultMulti] ========== runCurrentCommand START ==========');
      console.log('[CommandRunResultMulti] currentCommand:', currentCommand);

      // 创建新的任务会话
      const sessionId = taskSessionManager.createSession(currentCommand);
      const session = taskSessionManager.getSession(sessionId);

      // 刷新会话列表以触发Vue响应式更新
      this.refreshActiveSessions();

      let command = window.lodashM.cloneDeep(currentCommand);
      if (!command.output) command.output = "text";

      // 如果是composer命令，则动态生成cmd
      if (command.program === "quickcomposer") {
        console.log('[CommandRunResultMulti] This is a composer command');

        // 恢复完整的命令信息
        const fullCommand = this.commandManager.getFullComposerCommand(command);
        console.log('[CommandRunResultMulti] Full command after restore:', fullCommand);

        // 初始化任务列表
        this.initTaskList(sessionId, fullCommand);

        // 生成代码
        command.cmd = generateFlowsCode(fullCommand.flows);
        console.log('[CommandRunResultMulti] Generated code:', command.cmd);
      }

      this.needTempPayload && (await this.getTempPayload(command));

      // 如果命令包含子输入框，则设置子输入框
      if (command.cmd.includes("{{subinput")) {
        return this.setSubInput(sessionId, command);
      }

      this.fire(sessionId, command);
    },

    async fire(sessionId, currentCommand) {
      const session = taskSessionManager.getSession(sessionId);
      if (!session) return;

      currentCommand.cmd = this.assignSpecialVars(currentCommand.cmd);
      this.enableHtml = currentCommand.output === "html";

      let { outPlugin, action } = outputTypes[currentCommand.output];
      let earlyExit = this.fromUtools && outPlugin;

      if (outPlugin) {
        utools.hideMainWindow();
        !earlyExit || setTimeout(utools.outPlugin, 500);
      }

      let resultOpts = { outPlugin, action, earlyExit, sessionId };

      switch (currentCommand.program) {
        case "quickcommand":
        case "quickcomposer":
          console.log('[CommandRunResultMulti] Executing code for session:', sessionId);
          // 通过addVars传递sessionId，让preload.js处理会话隔离
          window.runCodeInSandbox(
            currentCommand.cmd,
            (stdout, stderr) => this.handleResult(sessionId, stdout, stderr, resultOpts),
            {
              enterData: this.$root.enterData,
              __sessionId: sessionId  // 传递sessionId给沙箱
            }
          );
          break;
        case "html":
          this.showRunResult(sessionId, currentCommand.cmd, true);
          break;
        default:
          this.childProcess = window.runCodeFile(
            currentCommand.cmd,
            this.getCommandOpt(currentCommand),
            currentCommand.output === "terminal" ? {} : false,
            (stdout, stderr) => this.handleResult(sessionId, stdout, stderr, resultOpts)
          );
          this.listenStopSign(sessionId);
          break;
      }
    },

    getCommandOpt(command) {
      let option =
        command.program === "custom"
          ? command.customOptions || {}
          : programs[command.program] || {};
      option.scptarg = command.scptarg || "";
      option.charset = command.charset || {};
      option.envPath = this.$root.nativeProfile.envPath.trim() || "";
      option.alias = this.$root.nativeProfile.alias.trim() || "";
      return option;
    },

    listenStopSign(sessionId) {
      const ctrlCListener = (e) => {
        if (e.key === "c" && e.ctrlKey) {
          quickcommand.kill(this.childProcess.pid);
          quickcommand.showMessageBox("命令已终止");
          document.removeEventListener("keydown", ctrlCListener);
        }
      };
      document.addEventListener("keydown", ctrlCListener);
    },

    escapeItem(item) {
      if (typeof item === "object") {
        try {
          item = JSON.stringify(item);
        } catch (_) {
          item = item.toString();
        }
      } else {
        item = item.toString();
      }
      item = JSON.stringify(item)
        .slice(1, -1)
        .replace(/`|'/g, "\\$&")
        .replace(/\{\{/g, "\\{\\{");
      return item;
    },

    assignSpecialVars(cmd) {
      let userData = dbManager.userData.all();
      let spVars = window.lodashM.filter(specialVars, (sp) => sp.repl);
      window.lodashM.forIn(spVars, (val, key) => {
        let label = val.label.slice(0, -2);
        if (cmd.includes(label)) {
          let replData = label === "{{usr:" ? userData : this.$root.enterData;
          cmd = cmd.replace(val.match, (x) =>
            this.escapeItem(val.repl(x, replData))
          );
        }
      });
      return cmd;
    },

    setSubInput(sessionId, currentCommand) {
      // 子输入框逻辑（暂时保持原样，后续可以优化）
      this.fromUtools && utools.setExpendHeight(0);
      let matched = specialVars.subinput.match.exec(currentCommand.cmd);
      let placeholder = matched?.[1]?.slice(1) || "↩ 执行命令，↑↓ 切换历史";

      let subInputValue = "";
      let history = [];
      let historyIdx = history.length;

      utools.setSubInput(({ text }) => {
        subInputValue = text;
      }, placeholder);

      let querySubInput = () => {
        let command = window.lodashM.cloneDeep(currentCommand);
        command.cmd = currentCommand.cmd.replace(
          specialVars.subinput.match,
          subInputValue
        );
        history.push(subInputValue);
        historyIdx = history.length;
        utools.setSubInputValue("");
        this.fire(sessionId, command);
      };

      setTimeout(() => {
        if (subInputValue) querySubInput();
      }, 100);
    },

    async getTempPayload(currentCommand) {
      const firstCmd = currentCommand.features?.cmds?.[0];
      if (!firstCmd) return;
      const type = firstCmd.type || "text";
      const getPayload = async () => {
        if (type === "text") return firstCmd;
        const cmdType = commandTypes[type];
        if (!cmdType.tempPayload) return {};
        return await cmdType.tempPayload();
      };
      this.$root.enterData = {
        type,
        payload: await getPayload(),
      };
    },

    handleResult(sessionId, stdout, stderr, options) {
      const session = taskSessionManager.getSession(sessionId);
      if (!session) return;

      if (stderr) {
        if (typeof window !== 'undefined' && window.__updateTaskProgress) {
          window.__updateTaskProgress('error', stderr);
        }
        return options.earlyExit
          ? alert(stderr)
          : this.showRunResult(sessionId, stderr, false);
      }

      if (!session.showTaskProgress && stdout) {
        !options.action(stdout?.toString()) || this.showRunResult(sessionId, stdout, true);
      }
    },

    async showRunResult(sessionId, content, isSuccess) {
      const session = taskSessionManager.getSession(sessionId);
      if (!session) return;

      if (content.__clearQuickcommandRunResult) {
        session.runResult = [];
      } else {
        content = await this.handleContent(content);
        session.runResult = session.runResult.concat(content);
      }

      session.runResultStatus = isSuccess;
      session.isResultShow = true;

      taskSessionManager.updateSession(sessionId, session);
      this.timeStamp = new Date().getTime();
      this.refreshActiveSessions();
      this.autoScroll();
    },

    async handleContent(content) {
      if (!window.lodashM.isArray(content)) content = [content];
      if (this.enableHtml) content = await this.cacheScript(content);
      return content;
    },

    autoHeight(e) {
      if (!this.fromUtools) return;
      let pluginHeight =
        e.height + this.headerHeight < this.maxHeight
          ? e.height + this.headerHeight
          : this.maxHeight;
      utools.setExpendHeight(pluginHeight);
    },

    autoScroll() {
      if (this.enableHtml) return;
      this.$nextTick(() => {
        let results = document.querySelectorAll(".result");
        if (!results.length) return;
        results[results.length - 1].scrollIntoView({
          block: "end",
          behavior: "smooth",
        });
      });
    },

    stopRun(sessionId) {
      const session = taskSessionManager.getSession(sessionId);
      if (!session) return;

      utools.removeSubInput();

      // 清理任务进度相关资源
      this.stopRealTimeUpdate();

      // 如果有任务进度信息，标记为手动关闭
      if (session.showTaskProgress && session.taskList.length > 0) {
        session.wasManuallyClosedDuringTask = true;
        taskSessionManager.updateSession(sessionId, session);
      }
    },

    /**
     * 开始拖动或长按（集成功能）
     */
    startDragOrLongPress(event, sessionId) {
      const session = taskSessionManager.getSession(sessionId);
      if (!session) return;

      const btn = event.currentTarget;
      const rect = btn.getBoundingClientRect();

      // 初始化拖动状态
      const dragState = {
        isDragging: true,
        hasMoved: false,
        dragStartPos: {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        },
        dragStartMousePos: {
          x: event.clientX,
          y: event.clientY,
        },
      };

      this.draggingStates.set(sessionId, dragState);

      if (session.floatingButtonPosition.x === null) {
        session.floatingButtonPosition = {
          x: rect.left,
          y: rect.top,
        };
        taskSessionManager.updateSession(sessionId, session);
      }

      // 启动长按定时器
      const longPressTimer = setTimeout(() => {
        // 检查是否已经移动过（如果移动过则不触发长按关闭）
        const currentDragState = this.draggingStates.get(sessionId);
        if (currentDragState && !currentDragState.hasMoved) {
          // 触发长按关闭
          this.closeFloatingButton(sessionId);
          // 清理事件监听
          document.removeEventListener('mousemove', onDrag);
          document.removeEventListener('mouseup', stopDrag);
        }
      }, this.longPressDuration);

      this.longPressStates.set(sessionId, {
        timer: longPressTimer,
        startTime: Date.now()
      });

      const onDrag = (e) => {
        // 取消长按定时器（因为开始拖动了）
        const longPressState = this.longPressStates.get(sessionId);
        if (longPressState && dragState.hasMoved) {
          clearTimeout(longPressState.timer);
          this.longPressStates.delete(sessionId);
        }
        this.onDrag(e, sessionId);
      };

      const stopDrag = () => {
        // 清理长按定时器
        const longPressState = this.longPressStates.get(sessionId);
        if (longPressState) {
          clearTimeout(longPressState.timer);
          this.longPressStates.delete(sessionId);
        }
        this.stopDrag(sessionId, onDrag, stopDrag);
      };

      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', stopDrag);

      event.preventDefault();
    },

    /**
     * 获取浮动按钮的提示文本
     */
    getFloatingButtonTooltip(sessionId) {
      const dragState = this.draggingStates.get(sessionId);
      const longPressState = this.longPressStates.get(sessionId);

      if (dragState?.isDragging && dragState?.hasMoved) {
        return '拖动调整位置';
      }
      if (longPressState) {
        return '长按关闭任务...';
      }

      const session = taskSessionManager.getSession(sessionId);
      return this.getSessionTooltip(session);
    },

    /**
     * 关闭悬浮按钮（完全移除会话）
     */
    closeFloatingButton(sessionId) {
      console.log('[CommandRunResultMulti] Closing floating button for session:', sessionId);

      // 清理拖动状态
      this.draggingStates.delete(sessionId);

      // 清理长按状态
      const state = this.longPressStates.get(sessionId);
      if (state) {
        clearTimeout(state.timer);
        this.longPressStates.delete(sessionId);
      }

      // 移除会话
      taskSessionManager.deleteSession(sessionId);

      // 刷新会话列表
      this.refreshActiveSessions();

      // 如果没有活跃会话了，停止实时更新
      if (this.activeSessions.length === 0) {
        this.stopRealTimeUpdate();
      }
    },

    frameLoad(initHeight) {
      this.frameInitHeight = initHeight;
    },

    async cacheScript(content) {
      let html = quickcommand.htmlParse(content.join(""));
      let scriptDoms = html.querySelectorAll("script");
      for (let i = 0; i < scriptDoms.length; i++) {
        let src = scriptDoms[i].src;
        if (!this.urlReg.test(src)) continue;
        let dest = window.getQuickcommandTempFile("js", "remoteScript_" + i);
        await quickcommand.downloadFile(src, dest);
        scriptDoms[i].src = "file://" + dest;
      }
      return [html.documentElement.innerHTML];
    },

    selectHandler() {
      this.selectText = window.getSelection().toString().trim();
    },

    clearSelect() {
      window.getSelection().removeAllRanges();
      this.selectText = null;
    },

    showBase64Img(sessionId, imgs) {
      const session = taskSessionManager.getSession(sessionId);
      if (!session) return;

      session.runResult = [];
      this.enableHtml = true;
      this.showRunResult(sessionId, imgs, true);
    },

    updateSessionResult(sessionId, result) {
      const session = taskSessionManager.getSession(sessionId);
      if (!session) return;

      session.runResult = result;
      taskSessionManager.updateSession(sessionId, session);
      this.refreshActiveSessions();
    },

    /**
     * 初始化任务列表
     */
    initTaskList(sessionId, command) {
      console.log('[CommandRunResultMulti] ========== initTaskList START ==========');

      const session = taskSessionManager.getSession(sessionId);
      if (!session) return;

      // 清理之前的任务数据
      session.taskList = [];
      this.stopRealTimeUpdate();

      // 重置取消标志
      session.isTaskCancelled = false;
      session.allTasksCompleted = false;
      session.wasManuallyClosedDuringTask = false;

      if (command.program !== "quickcomposer" || !command.flows) {
        session.showTaskProgress = false;
        taskSessionManager.updateSession(sessionId, session);
        return;
      }

      // 从flows中提取所有命令节点
      const mainFlow = command.flows.find(f => f.id === 'main') || command.flows[0];

      if (!mainFlow || !mainFlow.commands) {
        session.showTaskProgress = false;
        taskSessionManager.updateSession(sessionId, session);
        return;
      }

      // 构建任务列表（过滤掉调试用的console.log命令节点）
      session.taskList = mainFlow.commands
        .filter(cmd => {
          // 过滤掉禁用的命令
          if (cmd.disabled) return false;

          // 过滤掉调试用的console.log命令（没有label、desc、value的命令）
          if (!cmd.label && !cmd.desc && !cmd.value) {
            return false;
          }

          return true;
        })
        .map((cmd, index) => {
          const fullCommand = findCommandByValue(cmd.value);
          let programName = fullCommand?.program || cmd.program;
          if (cmd.value === 'quickcommand.runCode' && cmd.argvs?.language) {
            programName = cmd.argvs.language;
          }

          return {
            id: cmd.id || `task_${index}`,
            originalLabel: cmd.label || cmd.desc || cmd.value || `任务 ${index + 1}`,
            customTitle: cmd.userComments || null,
            desc: cmd.summary || (cmd.desc && cmd.desc !== cmd.label ? cmd.desc : ''),
            status: 'pending',
            error: null,
            programInfo: this.getProgramInfo(programName),
            startTime: null,
            endTime: null,
            duration: null,
          };
        });

      // 检查是否需要显示任务进度
      const shouldShowProgress = command.features?.showTaskProgress !== false;
      session.showTaskProgress = session.taskList.length > 0 && shouldShowProgress;

      if (session.showTaskProgress) {
        // 确保对话框显示
        session.isResultShow = true;

        // 记录任务总开始时间
        session.taskStartTime = Date.now();
        session.taskEndTime = null;
        session.totalDuration = null;

        // 注入任务状态更新函数
        this.injectTaskProgressTracker(sessionId);

        // 开始实时更新
        this.startRealTimeUpdate();
      }

      taskSessionManager.updateSession(sessionId, session);
      console.log('[CommandRunResultMulti] ========== initTaskList END ==========');
    },

    getProgramInfo(programName) {
      if (!programName) return null;
      return programs[programName] || null;
    },

    formatDuration(duration) {
      if (duration === null || duration === undefined) return '';
      if (duration < 1000) {
        return `${duration}ms`;
      } else if (duration < 60000) {
        return `${(duration / 1000).toFixed(1)}s`;
      } else {
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
      }
    },

    getCurrentRunningTime(task) {
      if (!task.startTime || task.status !== 'running') return 0;
      return Date.now() - task.startTime;
    },

    calculateTotalDuration(session) {
      if (!session.taskStartTime) return null;

      const allCompleted = session.taskList.every(task =>
        task.status === 'success' || task.status === 'error'
      );

      if (allCompleted) {
        if (session.taskEndTime) {
          return session.taskEndTime - session.taskStartTime;
        }
        const lastEndTime = Math.max(...session.taskList.map(task => task.endTime || 0));
        if (lastEndTime > 0) {
          return lastEndTime - session.taskStartTime;
        }
      }

      const hasRunning = session.taskList.some(task => task.status === 'running');
      if (hasRunning) {
        return Date.now() - session.taskStartTime;
      }

      return null;
    },

    startRealTimeUpdate() {
      if (this.realTimeUpdateTimer) {
        clearInterval(this.realTimeUpdateTimer);
      }

      this.realTimeUpdateTimer = setInterval(() => {
        // 更新所有活跃会话的总耗时
        const sessions = taskSessionManager.getActiveSessions();
        sessions.forEach(session => {
          session.totalDuration = this.calculateTotalDuration(session);
          taskSessionManager.updateSession(session.id, session);
        });
        this.refreshActiveSessions();
      }, 100);
    },

    stopRealTimeUpdate() {
      if (this.realTimeUpdateTimer) {
        clearInterval(this.realTimeUpdateTimer);
        this.realTimeUpdateTimer = null;
      }
    },

    /**
     * 注入任务进度跟踪器
     */
    injectTaskProgressTracker(sessionId) {
      const session = taskSessionManager.getSession(sessionId);
      if (!session) return;

      let taskIndex = 0;
      const self = this;

      // 创建会话专属的取消函数
      window[`__cancelTaskExecution_${sessionId}`] = () => {
        session.isTaskCancelled = true;
        taskSessionManager.updateSession(sessionId, session);
        console.log('[CommandRunResultMulti] Task execution cancelled for session:', sessionId);
      };

      // 创建会话专属的检查取消状态函数
      window[`__isTaskCancelled_${sessionId}`] = () => {
        const currentSession = taskSessionManager.getSession(sessionId);
        return currentSession ? currentSession.isTaskCancelled : false;
      };

      // 创建会话专属的更新函数
      window[`__updateTaskProgress_${sessionId}`] = (taskId, status, error = null) => {
        const currentSession = taskSessionManager.getSession(sessionId);
        if (!currentSession) return;

        const currentTime = Date.now();

        if (status === 'running') {
          const task = taskId ? currentSession.taskList.find(t => t.id === taskId) : currentSession.taskList[taskIndex];
          if (task) {
            task.startTime = currentTime;
            task.duration = null;
          }
        }

        if (status === 'success' || status === 'error') {
          const task = taskId ? currentSession.taskList.find(t => t.id === taskId) : currentSession.taskList[taskIndex];
          if (task && task.startTime) {
            task.endTime = currentTime;
            task.duration = currentTime - task.startTime;
          }
        }

        if (taskId) {
          const task = currentSession.taskList.find(t => t.id === taskId);
          if (task) {
            // 不要覆盖已经被取消的任务状态
            if (task.status !== 'cancelled') {
              task.status = status;
              if (error) {
                task.error = error;
              }
            }

            if (status === 'success' || status === 'error') {
              const currentTaskIndex = currentSession.taskList.findIndex(t => t.id === taskId);
              for (let i = currentTaskIndex + 1; i < currentSession.taskList.length; i++) {
                if (currentSession.taskList[i].status === 'pending') {
                  taskIndex = i;
                  currentSession.taskList[i].status = 'running';
                  currentSession.taskList[i].startTime = currentTime;
                  break;
                }
              }
            }
          }
        } else {
          if (taskIndex < currentSession.taskList.length) {
            // 不要覆盖已经被取消的任务状态
            if (currentSession.taskList[taskIndex].status !== 'cancelled') {
              currentSession.taskList[taskIndex].status = status;
              if (error) {
                currentSession.taskList[taskIndex].error = error;
              }
            }

            if (status === 'success' || status === 'error') {
              taskIndex++;
              if (taskIndex < currentSession.taskList.length) {
                currentSession.taskList[taskIndex].status = 'running';
                currentSession.taskList[taskIndex].startTime = currentTime;
              }
            }
          }
        }

        // 检查是否所有任务都已完成
        const allCompleted = currentSession.taskList.every(t =>
          t.status === 'success' || t.status === 'error' || t.status === 'cancelled'
        );

        if (allCompleted && !currentSession.allTasksCompleted) {
          currentSession.taskEndTime = currentTime;
          currentSession.totalDuration = self.calculateTotalDuration(currentSession);
          currentSession.allTasksCompleted = true;
          self.stopRealTimeUpdate();
          console.log('[TaskProgress] All tasks completed for session:', sessionId);

          // 如果结果页面处于悬浮框状态，自动关闭悬浮框
          if (!currentSession.isResultShow) {
            console.log('[TaskProgress] Auto-closing floating button in 500ms');
            setTimeout(() => {
              self.closeFloatingButton(sessionId);
            }, 500); // 延迟500ms关闭，让用户看到完成状态
          }
        }

        taskSessionManager.updateSession(sessionId, currentSession);
        self.refreshActiveSessions();
      };

      // 注意：会话专属函数会在 preload.js 的 runCodeInSandbox 中注入到沙箱
      // 通过 addVars.__sessionId 传递会话ID，preload.js 会自动将对应的会话函数注入到沙箱中
      // 每个会话的专属函数命名为：__functionName_${sessionId}

      // 设置第一个任务为运行中
      if (session.taskList.length > 0) {
        const currentTime = Date.now();
        const firstPendingTask = session.taskList.find(task => task.status === 'pending');
        if (firstPendingTask) {
          firstPendingTask.status = 'running';
          firstPendingTask.startTime = currentTime;
        } else {
          session.taskList[0].status = 'running';
          session.taskList[0].startTime = currentTime;
        }

        for (let i = 1; i < session.taskList.length; i++) {
          if (session.taskList[i].status !== 'running') {
            session.taskList[i].status = 'pending';
          }
        }

        taskSessionManager.updateSession(sessionId, session);
      }
    },

    /**
     * 取消任务
     */
    cancelTasks(sessionId) {
      const session = taskSessionManager.getSession(sessionId);
      if (!session) return;

      if (confirm('确定要终止当前及后续任务吗？')) {
        session.isTaskCancelled = true;

        session.taskList.forEach(task => {
          if (task.status === 'pending' || task.status === 'running') {
            task.status = 'cancelled';
            task.error = '任务已被用户终止';
          }
        });

        taskSessionManager.updateSession(sessionId, session);

        if (window[`__cancelTaskExecution_${sessionId}`]) {
          window[`__cancelTaskExecution_${sessionId}`]();
        }

        this.$forceUpdate();
      }
    },

    /**
     * 重新开始任务
     */
    restartTasks(sessionId) {
      const session = taskSessionManager.getSession(sessionId);
      if (!session || !session.currentCommand) return;

      // 删除旧会话
      taskSessionManager.deleteSession(sessionId);

      // 重新执行命令（会创建新会话）
      this.runCurrentCommand(session.currentCommand);
    },

    /**
     * 重新打开结果面板
     */
    reopenResultPanel(sessionId) {
      const session = taskSessionManager.getSession(sessionId);
      if (!session) return;

      session.isResultShow = true;
      session.wasManuallyClosedDuringTask = false;
      taskSessionManager.updateSession(sessionId, session);
      this.refreshActiveSessions();
    },

    /**
     * 浮动按钮相关方法
     */
    shouldShowFloatingButton(session) {
      // 不显示结果面板 && 有任务进度 && 有任务列表 && 任务未全部完成
      if (!session.isResultShow && session.showTaskProgress && session.taskList.length > 0) {
        // 检查是否所有任务都已完成
        const allCompleted = this.isSessionAllTasksFinished(session);
        return !allCompleted; // 任务全部完成后不显示悬浮按钮
      }
      return false;
    },

    getFloatingButtonColor(session) {
      if (this.isSessionTaskRunning(session)) {
        return 'primary'; // 运行中：蓝色
      } else if (session.isTaskCancelled) {
        // 已取消：检查是否有真正的错误
        const hasError = session.taskList.some(task => task.status === 'error');
        return hasError ? 'warning' : 'grey'; // 有错误：橙色，否则：灰色
      } else if (this.isSessionAllTasksFinished(session)) {
        const hasError = session.taskList.some(task => task.status === 'error');
        return hasError ? 'warning' : 'positive'; // 完成：绿色或橙色
      }
      return 'grey';
    },

    getFloatingButtonStyle(session) {
      const baseStyle = {
        position: 'fixed',
        zIndex: 9999,
        userSelect: 'none',
      };

      const dragState = this.draggingStates.get(session.id);
      baseStyle.cursor = dragState?.isDragging ? 'grabbing' : 'grab';

      // 计算浮动按钮位置（自动排列）
      const activeSessions = taskSessionManager.getActiveSessions();
      const sessionIndex = activeSessions.findIndex(s => s.id === session.id);

      // 如果有保存的位置，使用保存的位置
      if (session.floatingButtonPosition.x !== null && session.floatingButtonPosition.y !== null) {
        return {
          ...baseStyle,
          left: session.floatingButtonPosition.x + 'px',
          top: session.floatingButtonPosition.y + 'px',
        };
      }

      // 默认位置：右下角，垂直排列
      const buttonSize = 56;
      const gap = 16;
      const rightOffset = 16;
      const bottomOffset = 16 + sessionIndex * (buttonSize + gap);

      return {
        ...baseStyle,
        right: rightOffset + 'px',
        bottom: bottomOffset + 'px',
      };
    },

    getSessionTooltip(session) {
      const taskSummary = this.getSessionTaskSummary(session);
      const commandName = session.currentCommand?.name || '任务';
      return `${commandName} (${taskSummary})`;
    },

    getSessionTaskSummary(session) {
      const total = session.taskList.length;
      // 只统计真正完成的任务（成功或失败），不包括被取消的任务
      const completed = session.taskList.filter(t => t.status === 'success' || t.status === 'error').length;
      return `${completed}/${total}`;
    },

    getDraggingState(sessionId) {
      const dragState = this.draggingStates.get(sessionId);
      return dragState?.isDragging || false;
    },

    handleFloatingButtonClick(sessionId) {
      const dragState = this.draggingStates.get(sessionId);
      if (dragState?.hasMoved) {
        return;
      }
      this.reopenResultPanel(sessionId);
    },



    onDrag(event, sessionId) {
      const dragState = this.draggingStates.get(sessionId);
      if (!dragState?.isDragging) return;

      const session = taskSessionManager.getSession(sessionId);
      if (!session) return;

      const deltaX = Math.abs(event.clientX - dragState.dragStartMousePos.x);
      const deltaY = Math.abs(event.clientY - dragState.dragStartMousePos.y);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > 5) {
        dragState.hasMoved = true;
      }

      let newX = event.clientX - dragState.dragStartPos.x;
      let newY = event.clientY - dragState.dragStartPos.y;

      const btnSize = 56;
      const maxX = window.innerWidth - btnSize;
      const maxY = window.innerHeight - btnSize;

      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      session.floatingButtonPosition = { x: newX, y: newY };
      taskSessionManager.updateSession(sessionId, session);
      this.refreshActiveSessions();
    },

    stopDrag(sessionId, onDragHandler, stopDragHandler) {
      const dragState = this.draggingStates.get(sessionId);
      if (dragState) {
        dragState.isDragging = false;
      }

      document.removeEventListener('mousemove', onDragHandler);
      document.removeEventListener('mouseup', stopDragHandler);

      setTimeout(() => {
        if (dragState) {
          dragState.hasMoved = false;
        }
      }, 50);
    },

    /**
     * 会话状态判断
     */
    isSessionTaskRunning(session) {
      return session.taskList.some(task => task.status === 'running' || task.status === 'pending');
    },

    isSessionAllTasksFinished(session) {
      return session.taskList.length > 0 && session.taskList.every(task =>
        task.status === 'success' || task.status === 'error' || task.status === 'cancelled'
      );
    },

    getSessionProgramInfo(session) {
      if (!session.currentCommand) return null;
      const program = session.currentCommand.program;
      if (!program) return null;
      return this.getProgramInfo(program);
    },

    isDataUrl(runResult) {
      return runResult.join("").includes("data:image/");
    },

    /**
     * 获取会话的命令名称
     */
    getSessionCommandName(session) {
      if (!session.currentCommand) return '';
      return session.currentCommand.features?.explain || '可视化编排';
    },

    /**
     * 格式化会话启动时间
     */
    formatSessionStartTime(session) {
      if (!session.createdAt) return '';
      const date = new Date(session.createdAt);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    },
  },
  unmounted() {
    this.stopRealTimeUpdate();
    // 清理所有拖动事件监听器
    this.draggingStates.clear();
  },
};
</script>

<style scoped>
.command-run-result {
  background-color: var(--utools-bg-color);
  display: flex;
  flex-direction: column;
  height: 100%;
}

.command-run-result > div {
  background-color: var(--utools-bg-color);
}

.scroll {
  background-color: var(--utools-bg-color);
  flex: 1;
  overflow-y: auto;
}

.task-item {
  padding: 12px 16px;
}

.task-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.task-program-chip {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  min-height: 20px;
  padding: 2px 8px;
}

.task-original-title {
  font-weight: 500;
  font-size: 14px;
  line-height: 1.3;
  word-break: break-word;
}

.task-custom-title {
  font-weight: 400;
  font-size: 13px;
  line-height: 1.3;
  word-break: break-word;
  color: #666;
  margin-top: 2px;
}

.task-desc {
  margin-top: 2px;
  font-size: 12px;
  opacity: 0.7;
  line-height: 1.3;
}

.task-duration {
  margin-top: 4px;
  font-size: 11px;
  color: #666;
  display: flex;
  align-items: center;
}

.task-error {
  margin-top: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  line-height: 1.3;
}

.running-indicator {
  color: #1976d2;
  font-weight: 600;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}

.total-duration-chip {
  font-size: 12px;
  font-weight: 600;
}

.floating-task-button {
  transition: all 0.2s ease;
}

.floating-task-button:hover {
  transform: scale(1.1);
}

.body--dark .task-duration {
  color: #aaa;
}

.body--dark .task-custom-title {
  color: #aaa;
}
</style>
