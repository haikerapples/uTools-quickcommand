<template>
  <q-dialog
    v-model="showDialog"
    :maximized="maximized"
    :transition-show="maximized ? 'fade' : 'scale'"
    :transition-hide="maximized ? 'fade' : 'scale'"
    @hide="hideDialog"
  >
    <component
      ref="ui"
      :is="currentUI"
      :options="options"
      @clickOK="clickOK"
      @hide="showDialog = false"
    />
  </q-dialog>
  <!-- waitButton 单独一个 -->
  <q-btn
    class="fixed-top-right"
    style="z-index: 9999"
    v-if="showWb"
    color="primary"
    :label="wbLabel"
    @click="
      showWb = false;
      wbEvent();
    "
  />
</template>

<script>
import { Notify } from "quasar";
import { markRaw } from "vue";
import InputBox from "components/quickcommandUI/InputBox";
import ButtonBox from "components/quickcommandUI/ButtonBox";
import ConfirmBox from "components/quickcommandUI/ConfirmBox";
import TextArea from "components/quickcommandUI/TextArea";
import SelectList from "components/quickcommandUI/SelectList";
import programs from "js/options/programs";
import { dbManager } from "js/utools.js";

export default {
  components: {
    InputBox: markRaw(InputBox),
    ButtonBox: markRaw(ButtonBox),
    ConfirmBox: markRaw(ConfirmBox),
    TextArea: markRaw(TextArea),
    SelectList: markRaw(SelectList),
  },
  data() {
    return {
      currentUI: null,
      options: {},
      showDialog: false,
      maximized: false,
      showWb: false,
      wbLabel: "",
      listeners: [],
    };
  },
  mounted() {
    const quickcommandUI = {
      /**
       * 显示一个输入框组对话框，并返回用户输入的所有值
       *
       * @param options 数组，如果元素为字符串，则作为输入框的标签名；如果元素为对象，则作为输入框的属性，（旧），可为对象，包含label、value、hint三个属性
       *
       * @example options = ["请输入", "请输入2"]
       * @example options = [{label: "请输入", value: "", hint: ""}, {label: "请输入2", value: "", hint: ""}]
       * @example options = {labels: ["请输入", "请输入2"], values: ["", ""], hints: ["", ""]}
       *
       * @param title 窗口标题，默认为空
       *
       */
      showInputBox: (options = ["请输入"], title = "") =>
        new Promise((reslove, reject) => {
          let props = {
            labels: [],
            values: [],
            hints: [],
            title: title,
          };
          if (!window.lodashM.isObject(options))
            return reject(new TypeError(`应为 Object, 而非 ${typeof options}`));
          if (window.lodashM.isArray(options)) {
            options.forEach((item) => {
              if (typeof item === "string") {
                props.labels.push(item);
                props.values.push("");
                props.hints.push("");
              } else {
                props.labels.push(item.label);
                props.values.push(item.value);
                props.hints.push(item.hint);
              }
            });
          } else {
            // 兼容旧版本
            Object.assign(props, options);
          }
          this.showUI(InputBox, props, false, reslove);
        }),

      /**
       * 显示一个按钮组对话框，并返回用户点击的按钮的标签
       *
       * @param labels 按钮标签数组，默认为["确定"]
       * @param title 窗口标题，默认为空
       */
      showButtonBox: (labels = ["确定"], title = "") =>
        new Promise((reslove, reject) => {
          if (!window.lodashM.isArray(labels))
            return reject(new TypeError(`应为 Array, 而非 ${typeof labels}`));
          this.showUI(ButtonBox, { labels, title }, false, reslove);
        }),

      /**
       * 显示一个确认对话框，并返回用户点击的按钮的标签
       *
       * @param message 确认消息，默认为空
       * @param title 窗口标题，默认为空
       * @param isHtml 是否为html消息，默认为false
       * @param width 窗口宽度，默认为300
       */
      showConfirmBox: (message = "", title = "提示", isHtml = false, width) =>
        new Promise((reslove, reject) => {
          this.showUI(
            ConfirmBox,
            { message, title, isHtml, width },
            false,
            reslove
          );
        }),

      /**
       * 显示一个消息框，并返回用户点击的按钮的标签
       *
       * @param message 消息内容，默认为空
       * @param icon 消息图标，默认为"success"
       * @param time 消息显示时间，默认为消息内容长度乘以120毫秒
       * @param position 消息显示位置，默认为"top"
       */
      showMessageBox: (message, icon = "success", time, position = "top") => {
        message = window.lodashM.truncate(message.toString(), { length: 1200 });
        if (icon === "success") icon = "positive";
        if (icon === "error") icon = "negative";
        if (typeof time === "undefined")
          time = Math.max(message.toString().length * 120, 1000);
        Notify.create({
          type: icon,
          message: message,
          timeout: time,
          position: position,
          actions:
            time === 0
              ? [
                  {
                    label: "确定",
                    color: "white",
                  },
                ]
              : [],
        });
      },

      /**
       * 显示一个文本区域对话框，并返回用户输入的文本
       *
       * @param placeholder 文本区域提示，默认为空
       * @param value 文本区域默认值，默认为空
       */
      showTextArea: (placeholder = "", value = "") =>
        new Promise((reslove, reject) => {
          this.showUI(TextArea, { placeholder, value }, true, reslove);
        }),

      /**
       * 显示一个支持搜索的且可以动态更新的选项列表，选项类型为文本或html
       *
       * @param initItems 初始选项数组，默认为空
       * @param options 选项列表配置，默认为空
       * @example
       * initItems = ['1','2','3']
       * options = {placeholder: "输入进行筛选，支持拼音", optionType: "plaintext", enableSearch: true, showCancelButton: false, closeOnSelect: true}
       *
       * @example
       * initItems = [{title: "1", description: "1"},     {title: "2", description: "2"}, {title: "3", description: "3"}]
       * options = {placeholder: "输入进行筛选，支持拼音", optionType: "json", enableSearch: true, showCancelButton: false, closeOnSelect: true}
       *
       * 如需对每个选项单独注册点击事件，可以在initItems的元素中添加id和clickFn，如：
       * initItems = [{id:1, title: "1", description: "1", clickFn:function(e){console.log(e)}}, {id:2, title: "2", description: "2", clickFn:function(e){console.log(e)}}]
       *
       * @example
       * initItems = ["<div>1</div>", "<div>2</div>", "<div>3</div>"]
       * options = {placeholder: "输入进行筛选，支持拼音", optionType: "html", enableSearch: true, showCancelButton: false, closeOnSelect: true}
       */
      showSelectList: (initItems, options = {}) =>
        new Promise((reslove, reject) => {
          if (!window.lodashM.isArray(initItems))
            return reject(
              new TypeError(`应为 Array, 而非 ${typeof initItems}`)
            );
          let defaultOptions = {
            placeholder: "输入进行筛选，支持拼音",
            optionType: "plaintext",
            enableSearch: true,
            showCancelButton: false,
            closeOnSelect: true,
          };
          options = Object.assign(defaultOptions, options);
          this.showUI(SelectList, { initItems, options }, true, reslove);
        }),

      /**
       * 显示一个等待按钮，并返回用户点击的按钮的标签
       *
       * @param callback 等待回调函数
       * @param label 按钮标签，默认为"确定"
       */
      showWaitButton: (callback, label = "确定") => {
        this.wbLabel = label;
        this.showWb = true;
        this.wbEvent = callback;
      },

      /**
       * 关闭等待按钮
       */
      closeWaitButton: () => {
        this.showWb = false;
      },

      /**
       * 更新选项列表
       *
       * @param opt 新选项
       * @param id 选项索引，默认为undefined
       */
      updateSelectList: (opt, id) => {
        if (this.currentUI !== SelectList) throw "请先创建 selectList";
        if (typeof id === "undefined") this.$refs.ui.items.push(opt);
        else this.$refs.ui.items[id] = opt;
      },

      /**
       * 监听全局快捷键
       *
       * @param callback 快捷键回调函数
       */
      listenKeydown: (callback) => {
        this.listeners.push(callback);
        document.addEventListener("keydown", callback);
      },

      /**
       * 移除全局快捷键
       */
      removeListener: () => {
        this.listeners.forEach((listener) => {
          document.removeEventListener("keydown", listener);
        });
      },
    };
    // 将quickcommandUI添加到quickcommand
    Object.assign(window.quickcommand, quickcommandUI);

    // 获取用户数据
    window.quickcommand.userData = dbManager.userData;

    /**
     * 执行代码
     * 添加runCode方法，不在preload中加是因为programs写在了src中-_-
     * @param code 代码文本
     * @param options 选项
     * @param options.language 编程语言
     * @param options.args 脚本参数
     * @param options.scriptCode 脚本文件编码
     * @param options.outputCode 命令行输出编码
     * @param options.runInTerminal 终端运行参数，不传则不在终端运行
     * @param options.runInTerminal.dir 运行目录
     * @param options.runInTerminal.windows windows使用的终端，默认wt
     * @param options.runInTerminal.macos macos使用的终端，默认warp
     * @param options.waitForCompletion 是否等待终端命令执行完成（仅在runInTerminal模式下有效）
     * @param options.timeout 等待超时时间（毫秒），默认300000（5分钟）
     */
    quickcommand.runCode = (code, options) => {
      return new Promise((reslove, reject) => {
        const isWin = window.utools.isWindows();
        const {
          language = isWin ? "cmd" : "shell",
          args = [],
          runInTerminal,
          waitForCompletion = false,
          timeout = 300000,
        } = options;

        if (!options.scriptCode) {
          options.scriptCode = ["cmd", "powershell"].includes(language)
            ? "gbk"
            : "utf-8";
        }

        if (!options.outputCode) {
          options.outputCode = isWin ? "gbk" : "utf-8";
        }

        // 兼容编排，传入true时，使用默认终端
        const runInTerminalOptions =
          runInTerminal === true ? {} : runInTerminal;

        const unescapeAndQuote = (str) => `"${str.replace(/\\"/g, '"')}"`;

        if (!programs[language]) {
          return reject(new Error(`不支持的语言: ${language}`));
        }

        if (!Array.isArray(args)) {
          return reject(new TypeError(`args 应为 Array, 而非 ${typeof args}`));
        }
        const argsStr = args.map(unescapeAndQuote).join(" ");

        // 如果需要等待完成且在终端模式下运行
        let signalFilePath = null;
        let modifiedCode = code;

        if (runInTerminalOptions && waitForCompletion) {
          signalFilePath = window.generateSignalFilePath();

          // 根据不同语言添加创建信号文件的命令
          if (language === 'shell' || language === 'bash' || language === 'zsh') {
            // Unix shell
            modifiedCode = `${code}\necho "done" > "${signalFilePath}"`;
          } else if (language === 'cmd') {
            // Windows cmd
            modifiedCode = `${code}\necho done > "${signalFilePath}"`;
          } else if (language === 'powershell') {
            // PowerShell
            modifiedCode = `${code}\n"done" | Out-File -FilePath "${signalFilePath}"`;
          } else if (language === 'python' || language === 'python3') {
            // Python
            modifiedCode = `${code}\nimport os\nwith open(r"${signalFilePath}", "w") as f: f.write("done")`;
          } else if (language === 'node' || language === 'nodejs') {
            // Node.js
            modifiedCode = `${code}\nrequire('fs').writeFileSync("${signalFilePath}", "done");`;
          } else if (language === 'ruby') {
            // Ruby
            modifiedCode = `${code}\nFile.write("${signalFilePath}", "done")`;
          } else if (language === 'perl') {
            // Perl
            modifiedCode = `${code}\nopen(my $fh, '>', "${signalFilePath}"); print $fh "done"; close($fh);`;
          } else if (language === 'php') {
            // PHP
            modifiedCode = `${code}\nfile_put_contents("${signalFilePath}", "done");`;
          } else if (language === 'applescript') {
            // AppleScript
            const escapedPath = signalFilePath.replace(/"/g, '\\"');
            modifiedCode = `${code}\ndo shell script "echo 'done' > \\"${escapedPath}\\""`;
          } else if (language === 'lua') {
            // Lua
            modifiedCode = `${code}\nlocal file = io.open("${signalFilePath}", "w")\nfile:write("done")\nfile:close()`;
          } else if (language === 'c' || language === 'csharp') {
            // C/C# 编译型语言，在编译后的可执行文件末尾添加信号文件创建
            // 注意：这需要在源代码中添加，编译后执行
            if (language === 'c') {
              modifiedCode = `${code}\n#include <stdio.h>\nFILE *fp = fopen("${signalFilePath}", "w");\nif(fp) { fprintf(fp, "done"); fclose(fp); }`;
            } else {
              // C#
              modifiedCode = `${code}\nSystem.IO.File.WriteAllText("${signalFilePath}", "done");`;
            }
          } else if (language === 'custom') {
            // 自定义语言，尝试使用shell命令创建信号文件
            const isWin = window.utools.isWindows();
            const signalCmd = isWin
              ? `\necho done > "${signalFilePath}"`
              : `\necho "done" > "${signalFilePath}"`;
            modifiedCode = `${code}${signalCmd}`;
          } else {
            // 其他语言不支持等待完成
            console.warn(`语言 ${language} 不支持 waitForCompletion 选项`);
          }
        }

        // 在终端模式下且需要等待完成时，不依赖callback，直接等待信号文件
        if (runInTerminalOptions && signalFilePath) {
          // 启动终端执行脚本
          window.runCodeFile(
            modifiedCode,
            {
              ...programs[language],
              charset: {
                scriptCode: options.scriptCode,
                outputCode: options.outputCode,
              },
              scptarg: argsStr,
            },
            runInTerminalOptions,
            (result, err) => {
              // 在终端模式下，这个callback会在终端窗口打开后立即调用
              // 不在这里处理等待逻辑
              if (err) {
                console.error('启动终端失败:', err);
              }
            },
            false
          );

          // 立即开始等待信号文件（不等待callback）
          // 使用立即执行的async函数来处理await
          (async () => {
            try {
              await window.waitForSignalFile(signalFilePath, timeout);
              reslove(''); // 终端模式下没有输出结果
            } catch (waitErr) {
              reject(waitErr);
            }
          })();
        } else {
          // 非终端模式或不需要等待完成
          window.runCodeFile(
            modifiedCode,
            {
              ...programs[language],
              charset: {
                scriptCode: options.scriptCode,
                outputCode: options.outputCode,
              },
              scptarg: argsStr,
            },
            runInTerminalOptions,
            async (result, err) => {
              if (err) {
                reject(err);
              } else {
                // 如果需要等待完成（非终端模式），则等待信号文件
                if (signalFilePath) {
                  try {
                    await window.waitForSignalFile(signalFilePath, timeout);
                    reslove(result);
                  } catch (waitErr) {
                    reject(waitErr);
                  }
                } else {
                  reslove(result);
                }
              }
            },
            false
          );
        }
      });
    };

    // 冻结quickcommand
    Object.freeze(quickcommand);
  },
  methods: {
    clickOK() {},
    wbEvent() {},
    hideDialog() {},
    showUI(uiComponent, options, maximized, reslove) {
      this.showDialog = true;
      this.options = options;
      this.maximized = maximized;
      this.currentUI = uiComponent;
      this.clickOK = reslove;
      this.hideDialog = () => {
        switch (uiComponent) {
          case InputBox:
            reslove([]);
            break;
          case ButtonBox:
          case SelectList:
            reslove({});
            break;
          case ConfirmBox:
            reslove(false);
            break;
          case TextArea:
            reslove("");
            break;
          default:
            reslove(false);
        }
      };
    },
  },
};
</script>

<style>
.quickcommand-ui.q-card {
  background-color: var(--utools-bg-color);
}
</style>
