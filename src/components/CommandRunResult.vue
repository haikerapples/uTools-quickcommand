<template>
  <div>
    <q-dialog
      v-model="isResultShow"
      :position="fromUtools ? 'top' : 'bottom'"
      @hide="stopRun"
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
                :class="runResultStatus ? 'text-green' : 'text-red'"
                :name="runResultStatus ? 'task_alt' : 'error'"
                size="sm"
              ></q-icon>
            </q-avatar>
            <span class="text-weight-bold text-h7">运行结果</span>
          </div>
          <ResultMenu
            class="no-shadow q-pa-sm"
            :stretch="true"
            :runResult="runResult"
            :closebtn="!fromUtools"
            :textbtn="!enableHtml"
            :imagebtn="!enableHtml && isDataUrl"
            @showImg="showBase64Img"
            @updateResult="runResult = $event"
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
          <div v-if="showTaskProgress && taskList.length > 0" class="q-pa-md">
            <div class="text-h6 q-mb-md flex items-center justify-between">
              <span>任务执行进度</span>
              <q-chip
                v-if="totalDuration !== null"
                color="primary"
                text-color="white"
                size="sm"
                class="total-duration-chip"
              >
                <q-icon name="timer" size="xs" class="q-mr-xs" />
                总耗时: {{ formatDuration(totalDuration) }}
              </q-chip>
            </div>
            <q-list bordered separator>
              <q-item v-for="task in taskList" :key="task.id" class="task-item">
                <q-item-section avatar>
                  <q-icon
                    :name="
                      task.status === 'success'
                        ? 'check_circle'
                        : task.status === 'error'
                        ? 'error'
                        : task.status === 'running'
                        ? 'pending'
                        : 'radio_button_unchecked'
                    "
                    :color="
                      task.status === 'success'
                        ? 'positive'
                        : task.status === 'error'
                        ? 'negative'
                        : task.status === 'running'
                        ? 'primary'
                        : 'grey'
                    "
                  />
                </q-item-section>
                <q-item-section>
                  <!-- 主标题行：程序类型 + 原始标签 -->
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

                  <!-- 用户自定义标题 -->
                  <q-item-label v-if="task.customTitle" class="task-custom-title">
                    {{ task.customTitle }}
                  </q-item-label>

                  <!-- 描述信息 -->
                  <q-item-label v-if="task.desc" caption class="task-desc">
                    {{ task.desc }}
                  </q-item-label>

                  <!-- 执行时间信息 -->
                  <q-item-label v-if="task.duration !== null || (task.status === 'running' && task.startTime)" caption class="task-duration">
                    <q-icon name="schedule" size="xs" class="q-mr-xs" />
                    {{ task.duration !== null ? formatDuration(task.duration) : formatDuration(getCurrentRunningTime(task)) }}
                    <span v-if="task.status === 'running'" class="running-indicator">...</span>
                  </q-item-label>

                  <!-- 错误信息 -->
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
            v-if="!showTaskProgress"
            @frameLoad="frameLoad"
            :frameInitHeight="frameInitHeight"
            :enableHtml="enableHtml"
            :runResultStatus="runResultStatus"
            :runResult="runResult"
            :key="timeStamp"
            @mouseup="selectHandler"
          />
          <q-resize-observer @resize="autoHeight" debounce="0" />
        </div>
        <q-menu v-if="selectText" touch-position @before-hide="clearSelect">
          <ResultMenu :dense="true" :selectText="selectText" :textbtn="true" />
        </q-menu>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import outputTypes from "js/options/outputTypes.js";
import specialVars from "js/options/specialVars.js";
import commandTypes from "js/options/commandTypes.js";
import ResultArea from "components/ResultArea.vue";
import ResultMenu from "components/popup/ResultMenu.vue";
import { generateFlowsCode } from "js/composer/generateCode";
import { dbManager } from "js/utools.js";
import programs from "js/options/programs.js";
import { useCommandManager } from "js/commandManager.js";

export default {
  components: { ResultArea, ResultMenu },
  setup() {
    const commandManager = useCommandManager();
    return { commandManager };
  },
  data() {
    return {
      isResultShow: false,
      selectText: null,
      runResult: [],
      runResultStatus: true,
      subInputValue: "",
      ctrlCListener: null,
      quickcommandListener: null,
      history: [],
      historyIdx: null,
      enableHtml: false,
      frameInitHeight: 0,
      childProcess: null,
      timeStamp: null,
      urlReg:
        /^((ht|f)tps?):\/\/([\w\-]+(\.[\w\-]+)*\/)*[\w\-]+(\.[\w\-]+)*\/?(\?([\w\-\.,@?^=%&:\/~\+#]*)+)?/,
      // 任务进度相关
      showTaskProgress: false,
      taskList: [],
      currentCommand: null,
      taskProgressWindow: null, // 独立任务进度窗口控制器
      totalDuration: null, // 总执行耗时
      taskStartTime: null, // 所有任务开始时间
      taskEndTime: null, // 所有任务结束时间
      realTimeUpdateTimer: null, // 实时更新定时器
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
      // 使用视口高度的百分比，确保在不同窗口大小下都能适配
      return this.fromUtools ? Math.min(window.innerHeight * 0.9, 600) : Math.min(window.innerHeight * 0.7, 400);
    },
    headerHeight() {
      return this.enableHtml && this.fromUtools ? 0 : 40;
    },
    isDataUrl() {
      return this.runResult.join("").includes("data:image/");
    },
  },
watch: {
    showTaskProgress(newVal) {
      // 当任务进度显示状态改变时，确保对话框正确显示
      if (newVal && !this.isResultShow) {
        this.isResultShow = true;
      }
    },
  },
  methods: {
    // 关闭任务进度视图
    closeTaskProgress() {
      this.showTaskProgress = false;
      this.taskList = [];
    },
    // 运行命令
    async runCurrentCommand(currentCommand) {
      console.log('[TaskProgress] ========== runCurrentCommand START ==========');
      console.log('[TaskProgress] currentCommand:', currentCommand);

      let command = window.lodashM.cloneDeep(currentCommand);
      if (!command.output) command.output = "text";

      // 如果是composer命令，则动态生成cmd
      if (command.program === "quickcomposer") {
        console.log('[TaskProgress] This is a composer command');
        console.log('[TaskProgress] Original command.flows:', command.flows);

        // 恢复完整的命令信息（包括label等属性）
        const fullCommand = this.commandManager.getFullComposerCommand(command);
        console.log('[TaskProgress] Full command after restore:', fullCommand);
        console.log('[TaskProgress] Full command.flows:', fullCommand.flows);

        // 初始化任务列表（使用恢复后的完整命令）
        this.initTaskList(fullCommand);
        console.log('[TaskProgress] After initTaskList, showTaskProgress:', this.showTaskProgress);
        console.log('[TaskProgress] After initTaskList, taskList:', this.taskList);

        // 使用恢复后的flows生成代码
        command.cmd = generateFlowsCode(fullCommand.flows);
        console.log('[TaskProgress] Generated code:', command.cmd);
      }
      this.needTempPayload && (await this.getTempPayload(command));
      // 如果命令包含子输入框，则设置子输入框
      if (command.cmd.includes("{{subinput")) return this.setSubInput(command);
      this.fire(command);
    },
    async fire(currentCommand) {
      currentCommand.cmd = this.assignSpecialVars(currentCommand.cmd);
      this.enableHtml = currentCommand.output === "html";
      let { outPlugin, action } = outputTypes[currentCommand.output];
      let earlyExit = this.fromUtools && outPlugin;
      // 对于本身就没有输出的命令，无法确认命令是否执行完成，所以干脆提前退出插件
      // 弊端就是如果勾选了隐藏后台就完全退出的话，会造成命令直接中断
      if (outPlugin) {
        utools.hideMainWindow();
        !earlyExit || setTimeout(utools.outPlugin, 500);
      }
      let resultOpts = { outPlugin, action, earlyExit };
      switch (currentCommand.program) {
        case "quickcommand":
        case "quickcomposer":
          window.runCodeInSandbox(
            currentCommand.cmd,
            (stdout, stderr) => this.handleResult(stdout, stderr, resultOpts),
            { enterData: this.$root.enterData }
          );
          break;
        case "html":
          this.showRunResult(currentCommand.cmd, true);
          break;
        default:
          this.childProcess = window.runCodeFile(
            currentCommand.cmd,
            this.getCommandOpt(currentCommand),
            currentCommand.output === "terminal" ? {} : false,
            (stdout, stderr) => this.handleResult(stdout, stderr, resultOpts)
          );
          this.listenStopSign();
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
    listenStopSign() {
      // ctrl c 终止
      this.ctrlCListener = (e) => {
        if (e.key === "c" && e.ctrlKey) {
          quickcommand.kill(this.childProcess.pid);
          quickcommand.showMessageBox("命令已终止");
          document.removeEventListener("keydown", this.ctrlCListener);
        }
      };
      document.addEventListener("keydown", this.ctrlCListener);
    },
    escapeItem(item) {
      // 无论什么类型，先转为String
      if (typeof item === "object") {
        try {
          item = JSON.stringify(item);
        } catch (_) {
          item = item.toString();
        }
      } else {
        item = item.toString();
      }
      // 通过JSON.stringify，将所有特殊字符转义，输出为一个带双引号的字符串
      item = JSON.stringify(item)
        // 去掉两边双引号
        .slice(1, -1)
        // 单独转义单引号、反引号
        .replace(/`|'/g, "\\$&")
        // 转义双括号
        .replace(/\{\{/g, "\\{\\{");
      // .replace("$", '$$$')
      return item;
    },
    // 特殊变量赋值
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
    // 子输入框
    setSubInput(currentCommand) {
      this.fromUtools && utools.setExpendHeight(0);
      let matched = specialVars.subinput.match.exec(currentCommand.cmd);
      let placeholder = matched?.[1]?.slice(1) || "↩ 执行命令，↑↓ 切换历史";
      utools.setSubInput(({ text }) => {
        this.subInputValue = text;
      }, placeholder);
      let querySubInput = () => {
        let command = window.lodashM.cloneDeep(currentCommand);
        command.cmd = currentCommand.cmd.replace(
          specialVars.subinput.match,
          this.subInputValue
        );
        this.history.push(this.subInputValue);
        this.historyIdx = this.history.length;
        utools.setSubInputValue("");
        this.clear();
        this.fire(command);
      };
      // 自动粘贴的情况下自动执行
      setTimeout(() => {
        if (this.subInputValue) querySubInput();
      }, 100);
      let listener = (event) => {
        event.preventDefault();
        switch (event.keyCode) {
          case 13:
            querySubInput();
            break;
          case 38:
            if (!this.history.length) break;
            this.historyIdx = Math.max(0, this.historyIdx - 1);
            utools.setSubInputValue(this.history[this.historyIdx] || "");
            break;
          case 40:
            if (this.historyIdx === this.history.length) break;
            this.historyIdx = Math.min(
              this.history.length - 1,
              this.historyIdx + 1
            );
            utools.setSubInputValue(this.history[this.historyIdx] || "");
          default:
            break;
        }
      };
      this.$root.subInputEvent = ["keydown", listener, true];
      document.addEventListener(...this.$root.subInputEvent);
    },
    // payload 临时赋值
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
    handleResult(stdout, stderr, options) {
      if (stderr) {
        // 如果有错误，更新任务状态为失败
        if (typeof window !== 'undefined' && window.__updateTaskProgress) {
          window.__updateTaskProgress('error', stderr);
        }
        return options.earlyExit
          ? alert(stderr)
          : this.showRunResult(stderr, false);
      }
      // 只有在没有任务进度视图的情况下才显示结果
      // 让任务进度视图保持显示，直到所有任务完成
      if (!this.showTaskProgress && stdout) {
        !options.action(stdout?.toString()) || this.showRunResult(stdout, true);
      }
    },
    // 显示运行结果
    async showRunResult(content, isSuccess) {
      if (content.__clearQuickcommandRunResult) {
        this.runResult = [];
      } else {
        content = await this.handleContent(content);
        this.runResult = this.runResult.concat(content);
      }
      this.runResultStatus = isSuccess;
      // 刷新组件
      this.isResultShow
        ? (this.timeStamp = new Date().getTime())
        : (this.isResultShow = true);
      this.autoScroll();
    },
    async handleContent(content) {
      if (!window.lodashM.isArray(content)) content = [content];
      if (this.enableHtml) content = await this.cacheScript(content);
      return content;
    },
    // 根据输出自动滚动及调整 utools 高度
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
    stopRun() {
      this.runResult = [];
      utools.removeSubInput();
      if (!!this.$root.subInputEvent) {
        this.subInputValue = "";
        document.removeEventListener(...this.$root.subInputEvent);
      }
      this.clear();
      this.frameInitHeight = 0;

      // 清理任务进度相关资源
      this.stopRealTimeUpdate();
      // 注意：不清除showTaskProgress、taskList和totalDuration，让用户能看到最终结果
      // 只有在新的任务开始时才会重置这些值
    },
    clear() {
      !!this.ctrlCListener &&
        document.removeEventListener("keydown", this.ctrlCListener);
      quickcommand.removeListener();
      quickcommand.closeWaitButton();
    },
    frameLoad(initHeight) {
      this.frameInitHeight = initHeight;
    },
    // 预先下载远程脚本
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
    showBase64Img(imgs) {
      this.runResult = [];
      this.enableHtml = true;
      this.showRunResult(imgs, true);
    },
    // 初始化任务列表
    initTaskList(command) {
      console.log('[TaskProgress] ========== initTaskList START ==========');
      console.log('[TaskProgress] command:', JSON.stringify(command, null, 2));

      // 清理之前的任务数据
      this.taskList = [];
      this.stopRealTimeUpdate();

      if (command.program !== "quickcomposer" || !command.flows) {
        console.log('[TaskProgress] Not a composer command or no flows');
        console.log('[TaskProgress] program:', command.program);
        console.log('[TaskProgress] flows:', command.flows);
        this.showTaskProgress = false;
        return;
      }

      // 从flows中提取所有命令节点
      const mainFlow = command.flows.find(f => f.id === 'main') || command.flows[0];
      console.log('[TaskProgress] mainFlow:', JSON.stringify(mainFlow, null, 2));

      if (!mainFlow || !mainFlow.commands) {
        console.log('[TaskProgress] No mainFlow or commands');
        console.log('[TaskProgress] mainFlow:', mainFlow);
        this.showTaskProgress = false;
        return;
      }

      console.log('[TaskProgress] mainFlow.commands length:', mainFlow.commands.length);
      console.log('[TaskProgress] mainFlow.commands:', JSON.stringify(mainFlow.commands, null, 2));

      // 构建任务列表
      this.taskList = mainFlow.commands
        .filter(cmd => {
          const isDisabled = cmd.disabled;
          console.log(`[TaskProgress] Command ${cmd.value} disabled:`, isDisabled);
          return !isDisabled;
        })
        .map((cmd, index) => {
          console.log(`[TaskProgress] Processing command ${index}:`, JSON.stringify(cmd, null, 2));
          const task = {
            id: cmd.id || `task_${index}`,
            originalLabel: cmd.label || cmd.desc || cmd.value || `任务 ${index + 1}`,
            customTitle: cmd.userComments || null,
            desc: cmd.summary || (cmd.desc && cmd.desc !== cmd.label ? cmd.desc : ''),
            status: 'pending', // pending, running, success, error
            error: null,
            // 程序信息
            programInfo: this.getProgramInfo(cmd.program),
            // 执行时间相关
            startTime: null,
            endTime: null,
            duration: null, // 执行耗时（毫秒）
          };
          console.log(`[TaskProgress] Created task ${index}:`, JSON.stringify(task, null, 2));
          return task;
        });

      console.log('[TaskProgress] Final taskList length:', this.taskList.length);
      console.log('[TaskProgress] Final taskList:', JSON.stringify(this.taskList, null, 2));

      // 检查是否需要显示任务进度
      const shouldShowProgress = command.features?.showTaskProgress !== false;
      this.showTaskProgress = this.taskList.length > 0 && shouldShowProgress;
      console.log('[TaskProgress] shouldShowProgress:', shouldShowProgress);
      console.log('[TaskProgress] showTaskProgress:', this.showTaskProgress);

      // 显示任务进度
      if (this.showTaskProgress) {
        // 记录任务总开始时间
        this.taskStartTime = Date.now();
        this.taskEndTime = null;
        this.totalDuration = null;

        // 注入任务状态更新函数到全局
        this.injectTaskProgressTracker();

        // 开始实时更新
        this.startRealTimeUpdate();
      }
      console.log('[TaskProgress] ========== initTaskList END ==========');
    },
    // 获取程序信息
    getProgramInfo(programName) {
      if (!programName) return null;
      return programs[programName] || null;
    },

    // 格式化执行时间
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

    // 获取当前运行时间（用于实时显示）
    getCurrentRunningTime(task) {
      if (!task.startTime || task.status !== 'running') return 0;
      return Date.now() - task.startTime;
    },

    // 计算总耗时
    calculateTotalDuration() {
      if (!this.taskStartTime) return null;

      // 如果所有任务都完成了，使用最后完成的时间
      const allCompleted = this.taskList.every(task =>
        task.status === 'success' || task.status === 'error'
      );

      if (allCompleted) {
        // 如果已经记录了结束时间，使用它
        if (this.taskEndTime) {
          return this.taskEndTime - this.taskStartTime;
        }

        // 否则，找到最后一个完成的任务的结束时间
        const lastEndTime = Math.max(...this.taskList.map(task => task.endTime || 0));
        if (lastEndTime > 0) {
          return lastEndTime - this.taskStartTime;
        }
      }

      // 如果还有任务在运行，返回当前时间差
      const hasRunning = this.taskList.some(task => task.status === 'running');
      if (hasRunning) {
        return Date.now() - this.taskStartTime;
      }

      return null;
    },

    // 开始实时更新定时器
    startRealTimeUpdate() {
      if (this.realTimeUpdateTimer) {
        clearInterval(this.realTimeUpdateTimer);
      }

      this.realTimeUpdateTimer = setInterval(() => {
        // 更新总耗时
        this.totalDuration = this.calculateTotalDuration();

        // 强制更新视图（Vue的响应式更新）
        this.$forceUpdate();
      }, 100); // 每100ms更新一次
    },

    // 停止实时更新定时器
    stopRealTimeUpdate() {
      if (this.realTimeUpdateTimer) {
        clearInterval(this.realTimeUpdateTimer);
        this.realTimeUpdateTimer = null;
      }
    },

    // 注入任务进度跟踪器
    injectTaskProgressTracker() {
      let taskIndex = 0;
      const self = this;

      // 创建一个全局函数，用于更新任务状态
      window.__updateTaskProgress = (taskId, status, error = null) => {
        const currentTime = Date.now();

        // 记录任务开始时间
        if (status === 'running') {
          const task = taskId ? self.taskList.find(t => t.id === taskId) : self.taskList[taskIndex];
          if (task) {
            task.startTime = currentTime;
            task.duration = null; // 重置耗时
            console.log('[TaskProgress] Task started at:', new Date(currentTime).toLocaleTimeString(), 'for task:', task.originalLabel);
          }
        }

        // 记录任务结束时间并计算耗时
        if (status === 'success' || status === 'error') {
          const task = taskId ? self.taskList.find(t => t.id === taskId) : self.taskList[taskIndex];
          if (task && task.startTime) {
            task.endTime = currentTime;
            task.duration = currentTime - task.startTime;
            console.log('[TaskProgress] Task completed in:', self.formatDuration(task.duration), 'for task:', task.originalLabel);
          }

          // 检查是否所有任务都完成了
          const allCompleted = self.taskList.every(t =>
            t.status === 'success' || t.status === 'error'
          );

          if (allCompleted) {
            self.taskEndTime = currentTime;
            self.totalDuration = self.calculateTotalDuration();
            self.stopRealTimeUpdate(); // 停止实时更新
            console.log('[TaskProgress] All tasks completed. Total duration:', self.formatDuration(self.totalDuration));
          }
        }
        console.log('[TaskProgress] __updateTaskProgress called:', { taskId, status, error, taskIndex, taskListLength: self.taskList.length });

        // 如果传入了taskId，则根据taskId查找任务
        if (taskId) {
          const task = self.taskList.find(t => t.id === taskId);
          if (task) {
            task.status = status;
            if (error) {
              task.error = error;
            }
            console.log('[TaskProgress] Task updated by ID:', task);

            // 重要：当任务成功或失败时，推进taskIndex到下一个未完成的任务
            if (status === 'success' || status === 'error') {
              // 找到当前任务的索引
              const currentTaskIndex = self.taskList.findIndex(t => t.id === taskId);
              console.log('[TaskProgress] Current task index:', currentTaskIndex);

              // 推进到下一个未完成的任务
              for (let i = currentTaskIndex + 1; i < self.taskList.length; i++) {
                if (self.taskList[i].status === 'pending') {
                  taskIndex = i;
                  self.taskList[i].status = 'running';
                  self.taskList[i].startTime = currentTime;
                  console.log('[TaskProgress] Next task set to running:', self.taskList[i]);
                  break;
                }
              }
            }
          } else {
            console.log('[TaskProgress] Task not found by ID:', taskId);
          }
        } else {
          // 兼容旧的逻辑：使用taskIndex
          console.log('[TaskProgress] Using taskIndex fallback, current index:', taskIndex);
          if (taskIndex < self.taskList.length) {
            self.taskList[taskIndex].status = status;
            if (error) {
              self.taskList[taskIndex].error = error;
            }
            console.log('[TaskProgress] Task updated by index:', self.taskList[taskIndex]);

            if (status === 'success' || status === 'error') {
              taskIndex++;
              // 如果还有下一个任务，设置为运行中
              if (taskIndex < self.taskList.length) {
                self.taskList[taskIndex].status = 'running';
                self.taskList[taskIndex].startTime = currentTime;
                console.log('[TaskProgress] Next task set to running:', self.taskList[taskIndex]);
              }
            }
          }
        }

        // Vue 3响应式更新：创建新的数组引用触发更新
        self.taskList = [...self.taskList];
        console.log('[TaskProgress] taskList updated, triggering reactivity');

        // 检查是否所有任务都已完成
        const allTasksCompleted = self.taskList.every(task =>
          task.status === 'success' || task.status === 'error'
        );

        if (allTasksCompleted && self.showTaskProgress) {
          console.log('[TaskProgress] All tasks completed, keeping task progress view visible');
          // 不再自动隐藏进度视图，让用户可以查看完整的执行结果
        }
      };

      // 设置第一个任务为运行中
      if (this.taskList.length > 0) {
        const currentTime = Date.now();

        // 找到第一个pending状态的任务设置为running
        const firstPendingTask = this.taskList.find(task => task.status === 'pending');
        if (firstPendingTask) {
          firstPendingTask.status = 'running';
          firstPendingTask.startTime = currentTime;
          console.log('[TaskProgress] First pending task set to running:', firstPendingTask);
        } else {
          // 如果没有pending任务，设置第一个任务为running
          this.taskList[0].status = 'running';
          this.taskList[0].startTime = currentTime;
          console.log('[TaskProgress] First task set to running (fallback):', this.taskList[0]);
        }

        // 重要：立即设置所有后续任务为pending，确保状态一致性
        for (let i = 1; i < this.taskList.length; i++) {
          if (this.taskList[i].status !== 'running') {
            this.taskList[i].status = 'pending';
          }
        }
      }
    },
  },
  unmounted() {
    this.stopRun();
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

/* 任务进度相关样式 */
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

/* 深色模式适配 */
.body--dark .task-duration {
  color: #aaa;
}

.body--dark .task-custom-title {
  color: #aaa;
}
</style>
