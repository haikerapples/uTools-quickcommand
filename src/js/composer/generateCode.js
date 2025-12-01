export function generateCode(flow) {
  let usedVarNames = [];

  // 获取变量赋值代码，如果变量已经存在，则直接赋值，否则声明并赋值
  const getVarAssignCode = (varName, varValue) => {
    if (usedVarNames.includes(varName)) {
      return `${varName} = ${varValue}`;
    }
    usedVarNames.push(varName);
    if (!varValue) {
      return `let ${varName}`;
    }
    return `let ${varName} = ${varValue}`;
  };

  const getVarByPath = (name, path) => {
    return `${name}${path.startsWith("[") ? "" : "."}${path}`;
  };

  const { commands, name, label, customVariables = [] } = flow;

  const params = customVariables.filter((v) => v.type === "param") || [];
  const manualVars = customVariables.filter((v) => v.type === "var") || [];
  // 检查是否包含异步函数
  const hasAsyncFunction = commands.some((cmd) => cmd.asyncMode);

  let code = [];
  const funcName = name || "func_" + new Date().getTime();

  code.push(`// ${label}`);
  // 生成函数声明
  code.push(
    `${hasAsyncFunction ? "async " : ""}function ${funcName}(${params
      .map((p) => p.name)
      .join(", ")}) {`
  );

  const indent = "  ";
  const comma = ";";

  // 局部变量赋值
  manualVars.forEach((v) => {
    code.push(indent + getVarAssignCode(v.name, v.value) + comma);
  });

  commands.forEach((cmd, cmdIndex) => {
    // 跳过禁用的命令
    if (cmd.disabled) return;
    if (!cmd.code) return;

// 添加任务开始标记和取消检查
    code.push(indent + `// 任务 ${cmdIndex + 1}: ${cmd.label || cmd.desc || ''}`);
    code.push(indent + `// 检查任务是否被取消`);
    code.push(indent + `console.log('[Composer] Checking if task ${cmdIndex + 1} is cancelled...')${comma}`);
    code.push(indent + `console.log('[Composer] __isTaskCancelled exists:', typeof __isTaskCancelled !== 'undefined')${comma}`);
    code.push(indent + `if (typeof __isTaskCancelled !== 'undefined') {`);
    code.push(indent + indent + `console.log('[Composer] __isTaskCancelled() returns:', __isTaskCancelled())${comma}`);
    code.push(indent + `}`);
    code.push(indent + `if (typeof __isTaskCancelled !== 'undefined' && __isTaskCancelled()) {`);
    code.push(indent + indent + `console.log('[Composer] Task ${cmdIndex + 1} cancelled by user, throwing error')${comma}`);
    code.push(indent + indent + `typeof __updateTaskProgress !== 'undefined' && __updateTaskProgress('${cmd.id || `task_${cmdIndex}`}', 'error', '任务已被用户终止')${comma}`);
    code.push(indent + indent + `throw new Error('TASK_CANCELLED_BY_USER')${comma}`);
    code.push(indent + `}`);
    code.push(indent + `console.log('[Composer] Starting task ${cmdIndex + 1} with ID: ${cmd.id || `task_${cmdIndex}`}')${comma}`);
    code.push(indent + `console.log('[Composer] About to call __updateTaskProgress for task ${cmdIndex + 1}')${comma}`);
    code.push(indent + `console.log('[Composer] __updateTaskProgress exists:', typeof __updateTaskProgress !== 'undefined')${comma}`);
    code.push(indent + `typeof __updateTaskProgress !== 'undefined' && __updateTaskProgress('${cmd.id || `task_${cmdIndex}`}', 'running')${comma}`);
    code.push(indent + `console.log('[Composer] Called __updateTaskProgress for task ${cmdIndex + 1}')${comma}`);

    let cmdCode = cmd.code;
    // 处理输出变量
    const outputVariable = cmd.outputVariable || {};
    const { name, details } = outputVariable;
    if (name || !window.lodashM.isEmpty(details)) {
      if (cmd.asyncMode === "then") {
        // 使用回调函数模式
        if (cmd.callbackFunc) {
          // 如果回调函数存在，则使用回调函数模式，否则保持原样
          if (!details) {
cmdCode = `${cmdCode}.then(${cmd.callbackFunc}).then(() => { typeof __updateTaskProgress !== 'undefined' && __updateTaskProgress('${cmd.id || `task_${cmdIndex}`}', 'success'); })`;
          } else {
            // 如果输出变量有详细变量，则需要为每个变量赋值
            const promiseName = name || "__result";

            const extractVarCode = Object.entries(details)
              .map(
                ([path, varName]) =>
                  `let ${varName} = ${getVarByPath(promiseName, path)};`
              )
              .join("\n");

            const funcName = cmd.callbackFunc;

            const funcParams =
              (name ? `${name},` : "") + Object.values(details).join(",");

cmdCode = `${cmdCode}.then((${promiseName})=>{
              ${extractVarCode}
              ${funcName}(${funcParams})
              console.log('[Composer] Task ${cmdIndex + 1} completed successfully');
              typeof __updateTaskProgress !== 'undefined' && __updateTaskProgress('${cmd.id || `task_${cmdIndex}`}', 'success');
              })`;
          }
        } else {
// 没有回调函数，直接添加成功标记
          cmdCode = `${cmdCode}.then(() => { console.log('[Composer] Task ${cmdIndex + 1} completed successfully'); typeof __updateTaskProgress !== 'undefined' && __updateTaskProgress('${cmd.id || `task_${cmdIndex}`}', 'success'); })`;
        }
        code.push(indent + cmdCode + comma);
      } else if (cmd.asyncMode === "await") {
        // 使用 await 模式 - 需要特殊处理信号文件同步
        const promiseName = name || "__result";

        // 检查是否是quickcommand.runCode调用
        if (cmdCode.includes('quickcommand.runCode')) {
          // 提取runCode调用的参数
          const runCodeMatch = cmdCode.match(/quickcommand\.runCode\s*\(([^]*?)\s*,\s*({[^]*?})\s*\)/);
          if (runCodeMatch) {
            const [fullMatch, scriptCode, optionsStr] = runCodeMatch;

            // 确保waitForCompletion被设置为true
            let modifiedOptions = optionsStr;
            if (!modifiedOptions.includes('waitForCompletion:true')) {
              // 如果options中没有waitForCompletion，添加它
              if (modifiedOptions.endsWith('}')) {
                modifiedOptions = modifiedOptions.slice(0, -1) + ', waitForCompletion: true}';
              } else {
                modifiedOptions = modifiedOptions + ', waitForCompletion: true';
              }
            }

            // 使用修改后的选项重新构建runCode调用
            const modifiedRunCode = `quickcommand.runCode(${scriptCode}, ${modifiedOptions})`;
            cmdCode = getVarAssignCode(promiseName, `await ${modifiedRunCode}`);
            code.push(indent + cmdCode + comma);
          } else {
            // 无法解析的runCode调用，使用原始逻辑
            cmdCode = getVarAssignCode(promiseName, `await ${cmdCode}`);
            code.push(indent + cmdCode + comma);
          }
        } else {
          // 非runCode调用，使用原始逻辑
          cmdCode = getVarAssignCode(promiseName, `await ${cmdCode}`);
          code.push(indent + cmdCode + comma);
        }

        // 处理详细变量
        if (details) {
          Object.entries(details).forEach(([path, varName]) => {
            code.push(
              indent +
                `${getVarAssignCode(
                  varName,
                  getVarByPath(promiseName, path)
                )}` +
                comma
            );
          });
        }
// 添加任务完成标记（await命令）
        code.push(indent + `console.log('[Composer] Task ${cmdIndex + 1} completed successfully')${comma}`);
        code.push(indent + `console.log('[Composer] About to call __updateTaskProgress success for task ${cmdIndex + 1}')${comma}`);
        code.push(indent + `typeof __updateTaskProgress !== 'undefined' && __updateTaskProgress('${cmd.id || `task_${cmdIndex}`}', 'success')${comma}`);
        code.push(indent + `console.log('[Composer] Called __updateTaskProgress success for task ${cmdIndex + 1}')${comma}`);
      } else {
        // 非Async命令
        const resultVarName = name || "__result";
        cmdCode = getVarAssignCode(resultVarName, `${cmdCode}`);
        code.push(indent + cmdCode + comma);
        // 处理详细变量
        if (details) {
          Object.entries(details).forEach(([path, varName]) => {
            code.push(
              indent +
                `${getVarAssignCode(
                  varName,
                  getVarByPath(resultVarName, path)
                )}` +
                comma
            );
          });
        }
// 添加任务完成标记（非async命令）
        code.push(indent + `console.log('[Composer] Task ${cmdIndex + 1} completed successfully')${comma}`);
        code.push(indent + `console.log('[Composer] About to call __updateTaskProgress success for task ${cmdIndex + 1}')${comma}`);
        code.push(indent + `typeof __updateTaskProgress !== 'undefined' && __updateTaskProgress('${cmd.id || `task_${cmdIndex}`}', 'success')${comma}`);
        code.push(indent + `console.log('[Composer] Called __updateTaskProgress success for task ${cmdIndex + 1}')${comma}`);
      }
    } else {
      if (cmd.asyncMode === "await") {
        cmdCode = `await ${cmdCode}`;
      }
      code.push(indent + cmdCode + (cmd.isControlFlow ? "" : comma));
// 非Async命令，添加任务完成标记
        code.push(indent + `console.log('[Composer] Task ${cmdIndex + 1} completed successfully')${comma}`);
        code.push(indent + `console.log('[Composer] About to call __updateTaskProgress success for task ${cmdIndex + 1}')${comma}`);
        code.push(indent + `typeof __updateTaskProgress !== 'undefined' && __updateTaskProgress('${cmd.id || `task_${cmdIndex}`}', 'success')${comma}`);
        code.push(indent + `console.log('[Composer] Called __updateTaskProgress success for task ${cmdIndex + 1}')${comma}`);
    }
  });

  code.push("};"); // Close the function

// 如果是主函数，则自动执行，并添加错误处理
  if (funcName === "main") {
    code.push("\n// 执行主函数并处理取消情况");
    code.push("main().catch(err => {");
    code.push("  if (err && err.message === 'TASK_CANCELLED_BY_USER') {");
    code.push("    console.log('[Composer] Execution cancelled by user');");
    code.push("  } else if (typeof __isTaskCancelled !== 'undefined' && __isTaskCancelled()) {");
    code.push("    console.log('[Composer] Execution cancelled by user');");
    code.push("  } else {");
    code.push("    console.error('[Composer] Execution error:', err);");
    code.push("  }");
    code.push("});");
  }

  const finalCode = code.join("\n");

  return finalCode;
}

export function generateFlowsCode(flows) {
  const [mainFlow, ...subFlows] = flows;

  // 注意：不再清除终端窗口管理器，以支持多个编排并发执行
  // 每个编排的脚本会自动复用或创建新的终端窗口

  const flowsCode = [...subFlows, mainFlow].map((flow) => generateCode(flow)).join("\n\n");

  return flowsCode;
}
