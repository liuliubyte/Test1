// ==UserScript==
// @name         学习通全能助手 - 提取+客观题抢救+主观题精答 (DeepSeek版)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  DeepSeek驱动，支持UI拖拽与折叠，新增【实时状态播报窗口】，告别烦人的弹窗打扰
// @match        *://*.chaoxing.com/*
// @grant        GM_xmlhttpRequest
// @connect      api.deepseek.com
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 【请在这里填入你的 DeepSeek API Key】
    // 申请地址：https://platform.deepseek.com/
    // ==========================================
    const API_KEY = "这里填入你的DeepSeek API";

    // ==========================================
    // 界面 UI 注入与拖拽逻辑
    // ==========================================
    let style = document.createElement('style');
    style.textContent = `
        .zt-panel { position:fixed; top:15%; left:20px; z-index:999999; background:rgba(255,255,255,0.95); border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.15); border:1px solid #e0e0e0; backdrop-filter:blur(8px); width: 260px; font-family: sans-serif; display:flex; flex-direction:column; overflow:hidden; transition: box-shadow 0.2s; }
        .zt-header { display:flex; justify-content:space-between; align-items:center; padding:10px 16px; background:#f8f9fa; border-bottom:1px solid #eee; cursor:grab; user-select:none; }
        .zt-header:active { cursor:grabbing; background:#e9ecef; }
        .zt-title { font-size:15px; font-weight:bold; color:#333; margin:0; }
        .zt-controls { display:flex; gap:8px; align-items:center; }
        .zt-btn-ctrl { background:none; border:none; color:#666; font-size:16px; cursor:pointer; padding:0 4px; line-height:1; font-family:monospace; font-weight:bold; transition:color 0.2s; }
        .zt-btn-ctrl:hover { color:#000; }
        .zt-body { display:flex; flex-direction:column; gap:10px; padding:14px; transition: height 0.3s; }
        .zt-btn { padding:10px 15px; border:none; border-radius:6px; cursor:pointer; font-size:14px; font-weight:bold; color:white; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); width: 100%; text-align: center; }
        .zt-btn:active { transform: scale(0.95); }
        .zt-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .zt-btn-ext { background: #FF5722; } .zt-btn-ext:hover { background: #E64A19; }
        .zt-btn-obj { background: #4CAF50; } .zt-btn-obj:hover { background: #388E3C; }
        .zt-btn-sub { background: #2196F3; } .zt-btn-sub:hover { background: #1976D2; }
        /* 状态播报窗口样式 */
        .zt-log-box { margin-top: 5px; height: 130px; background: #2b2b2b; color: #a9b7c6; border-radius: 6px; padding: 8px; font-size: 12px; font-family: monospace; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); word-break: break-all; }
        .zt-log-box::-webkit-scrollbar { width: 6px; }
        .zt-log-box::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
        .zt-log-time { color: #629755; margin-right: 4px; }
        .zt-log-info { color: #a9b7c6; }
        .zt-log-success { color: #6a8759; font-weight: bold; }
        .zt-log-warn { color: #cc7832; font-weight: bold; }
        .zt-log-error { color: #cc666e; font-weight: bold; }
    `;
    document.head.appendChild(style);

    // 主面板
    let panel = document.createElement('div');
    panel.className = 'zt-panel';
    panel.id = 'zt-main-panel';
    document.body.appendChild(panel);

    // 头部区域 (包含标题和控制按钮)
    let header = document.createElement('div');
    header.className = 'zt-header';
    panel.appendChild(header);

    let title = document.createElement('div');
    title.className = 'zt-title';
   title.innerHTML = `
    <div style="display: flex; flex-direction: column; line-height: 1.2; text-align: left;">
        <span style="font-size: 16px; font-weight: 900; color: #1e293b; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
            ✨ Q&A Assistant
        </span>
        <span style="font-size: 11px; color: #64748b; font-family: 'JetBrains Mono', Consolas, monospace; margin-top: 2px;">
            Design by Hutch
        </span>
    </div>
`;
    header.appendChild(title);

    let controls = document.createElement('div');
    controls.className = 'zt-controls';
    header.appendChild(controls);

    let minBtn = document.createElement('button');
    minBtn.className = 'zt-btn-ctrl';
    minBtn.innerHTML = '-';
    minBtn.title = '最小化';
    controls.appendChild(minBtn);

    let closeBtn = document.createElement('button');
    closeBtn.className = 'zt-btn-ctrl';
    closeBtn.innerHTML = 'x';
    closeBtn.title = '关闭窗口';
    controls.appendChild(closeBtn);

    // 身体区域
    let bodyContainer = document.createElement('div');
    bodyContainer.className = 'zt-body';
    panel.appendChild(bodyContainer);

    let btnExt = document.createElement('button');
    btnExt.className = 'zt-btn zt-btn-ext';
    btnExt.innerHTML = '🚀 0. 抓取题目';
    bodyContainer.appendChild(btnExt);

    let btnObj = document.createElement('button');
    btnObj.className = 'zt-btn zt-btn-obj';
    btnObj.innerHTML = '🎯 1. 秒杀客观题';
    bodyContainer.appendChild(btnObj);

    let btnSub = document.createElement('button');
    btnSub.className = 'zt-btn zt-btn-sub';
    btnSub.innerHTML = '✍️ 2. 精答主观题';
    bodyContainer.appendChild(btnSub);

    // 日志播报窗口
    let logBox = document.createElement('div');
    logBox.className = 'zt-log-box';
    bodyContainer.appendChild(logBox);

    // ==========================================
    // 日志播报系统
    // ==========================================
    function logMsg(msg, type = 'info') {
        let p = document.createElement('div');
        let timeStr = new Date().toLocaleTimeString('en-US', {hour12: false});
        let typeClass = `zt-log-${type}`; // 对应 CSS 类名: info, success, warn, error

        p.innerHTML = `<span class="zt-log-time">[${timeStr}]</span><span class="${typeClass}">${msg}</span>`;
        logBox.appendChild(p);

        // 自动滚动到最底部
        logBox.scrollTop = logBox.scrollHeight;
    }

    logMsg('初始化完成，系统待命。', 'success');

    // === 控制按钮逻辑 ===
    minBtn.onclick = function() {
        if (bodyContainer.style.display === 'none') {
            bodyContainer.style.display = 'flex';
            minBtn.innerHTML = '-';
            minBtn.title = '最小化';
        } else {
            bodyContainer.style.display = 'none';
            minBtn.innerHTML = '+';
            minBtn.title = '展开面板';
        }
    };

    closeBtn.onclick = function() {
        panel.remove();
    };

    // === 拖拽逻辑 ===
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    header.addEventListener('mousedown', function(e) {
        if (e.target.tagName.toLowerCase() === 'button') return;
        isDragging = true;
        offsetX = e.clientX - panel.getBoundingClientRect().left;
        offsetY = e.clientY - panel.getBoundingClientRect().top;
        panel.style.boxShadow = '0 12px 32px rgba(0,0,0,0.25)';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });

    function onMouseMove(e) {
        if (!isDragging) return;
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;
        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    }

    function onMouseUp() {
        isDragging = false;
        panel.style.boxShadow = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    // ==========================================
    // 核心工具函数
    // ==========================================
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function findQuestionsInDocument(doc, className, resultList) {
        if (!doc) return;
        doc.querySelectorAll(className).forEach(el => resultList.push(el));
        let iframes = doc.querySelectorAll('iframe');
        for (let i = 0; i < iframes.length; i++) {
            try {
                let innerDoc = iframes[i].contentDocument || iframes[i].contentWindow.document;
                findQuestionsInDocument(innerDoc, className, resultList);
            } catch (e) {}
        }
    }

    function askAI(promptText, isJsonMode = false) {
        return new Promise((resolve, reject) => {
            let systemMsg = isJsonMode ?
                "严格输出无格式化缩进的合法JSON。" :
                "你是一个专业老师。请直接给出这道题的详细解答，不要任何废话，不要包含题目本身。";

            GM_xmlhttpRequest({
                method: "POST",
                url: "https://api.deepseek.com/chat/completions",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + API_KEY
                },
                data: JSON.stringify({
                    model: "deepseek-chat",
                    max_tokens: 4096,
                    messages: [
                        {"role": "system", "content": systemMsg},
                        {"role": "user", "content": promptText}
                    ]
                }),
                onload: function(response) {
                    if (response.status === 200) {
                        let resJson = JSON.parse(response.responseText);
                        resolve(resJson.choices[0].message.content);
                    } else {
                        reject("API报错: " + response.status);
                    }
                },
                onerror: function() {
                    reject("网络请求被拦截或失败");
                }
            });
        });
    }

    // ==========================================
    // 功能 0：穿透抓取所有题目
    // ==========================================
    btnExt.onclick = function() {
        logMsg('🚀 开始穿透搜索题目...', 'info');
        let allQuestionElements = [];
        findQuestionsInDocument(document, ".questionLi", allQuestionElements);

        if (allQuestionElements.length === 0) {
            logMsg('❌ 没找到题目，请检查页面是否加载完毕。', 'error');
            return;
        }

        let allQuestionsText = "";
        for (let i = 0; i < allQuestionElements.length; i++) {
            let singleQuestion = allQuestionElements[i].textContent.replace(/\s+/g, ' ').trim();
            allQuestionsText += "【第 " + (i + 1) + " 题】: " + singleQuestion + "\n\n";
        }

        console.log("----- 抓取到的完整题目 -----");
        console.log(allQuestionsText);
        logMsg(`✅ 成功抓取 ${allQuestionElements.length} 道题！请按 F12 在控制台查看文本。`, 'success');
    };

    // ==========================================
    // 功能 1：客观题专杀（JSON + 断点抢救机制）
    // ==========================================
    btnObj.onclick = async function() {
        if (API_KEY === "这里填入你的DeepSeek_API_KEY" || API_KEY === "") {
            logMsg('❌ 缺少 API_KEY，请先在脚本内配置！', 'error');
            alert("请先在代码内配置 API Key！");
            return;
        }

        btnObj.disabled = true;
        logMsg('🔍 正在扫描客观题...', 'info');

        let allQuestionElements = [];
        findQuestionsInDocument(document, ".questionLi", allQuestionElements);

        let objMapping = [];
        let objQuestionsText = "";
        let aiIndex = 1;

        allQuestionElements.forEach((box) => {
            let inputs = box.querySelectorAll('.answerBg, [onclick*="addChoice"]');
            if (inputs.length > 0) {
                let singleQuestion = box.textContent.replace(/\s+/g, ' ').trim();
                objQuestionsText += `【第${aiIndex}题】:${singleQuestion}\n`;
                objMapping[aiIndex] = box;
                aiIndex++;
            }
        });

        if (aiIndex === 1) {
            logMsg('⚠️ 当前页面未找到客观题(无选项)。', 'warn');
            btnObj.disabled = false;
            return;
        }

        logMsg(`🎯 收集到 ${aiIndex - 1} 道客观题，正在呼叫 DeepSeek...`, 'info');

        let prompt = `你是一个做题助手。阅读题目并给出答案。
要求极度严格：
1. 必须且只能返回纯净的 JSON 数组：[{"q":1,"ans":"C"}]
2. 判断题 ans 用 "正确" 或 "错误"。多选题连写如 "ABC"。
3. 不要任何空格、换行或格式化缩进，极限压缩体积！

题目如下：
${objQuestionsText}`;

        try {
            let aiReply = await askAI(prompt, true);
            logMsg('✅ DeepSeek 响应成功，解析校验中...', 'info');
            aiReply = aiReply.replace(/```json/g, "").replace(/```/g, "").trim();

            let answers;
            try {
                answers = JSON.parse(aiReply);
            } catch (parseError) {
                logMsg('⚠️ JSON被截断，启动断点紧急抢救机制...', 'warn');
                let lastBraceIndex = aiReply.lastIndexOf('}');
                if (lastBraceIndex !== -1) {
                    let salvagedStr = aiReply.substring(0, lastBraceIndex + 1) + ']';
                    answers = JSON.parse(salvagedStr);
                    logMsg(`🚨 抢救成功！已挽回前 ${answers.length} 道题。`, 'success');
                } else {
                    throw parseError;
                }
            }

            let clickCount = 0;
            logMsg('🤖 开始自动填写客观题...', 'info');

            answers.forEach(ansObj => {
                let qIndex = ansObj.q;
                let answerStr = ansObj.ans;
                if (!answerStr) return;

                let questionBox = objMapping[qIndex];
                if (!questionBox) return;

                let inputs = Array.from(questionBox.querySelectorAll('.answerBg, [onclick*="addChoice"]'));
                if (inputs.length === 0) return;

                let clickedThisQuestion = false;

                if (answerStr.includes("正确") || answerStr.includes("对")) {
                    let found = false;
                    for (let opt of inputs) {
                        if (opt.textContent.includes("对") || opt.textContent.includes("正确") || opt.textContent.includes("是") || opt.textContent.includes("√")) {
                            opt.click(); clickCount++; found = true; clickedThisQuestion = true; break;
                        }
                    }
                    if (!found && inputs.length >= 2) { inputs[0].click(); clickCount++; clickedThisQuestion = true; }
                }
                else if (answerStr.includes("错误") || answerStr.includes("错")) {
                    let found = false;
                    for (let opt of inputs) {
                        if (opt.textContent.includes("错") || opt.textContent.includes("错误") || opt.textContent.includes("否") || opt.textContent.includes("×")) {
                            opt.click(); clickCount++; found = true; clickedThisQuestion = true; break;
                        }
                    }
                    if (!found && inputs.length >= 2) { inputs[1].click(); clickCount++; clickedThisQuestion = true; }
                }
                else {
                    let letterToIndex = {'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6};
                    for (let i = 0; i < answerStr.length; i++) {
                        let char = answerStr[i].toUpperCase();
                        let targetIndex = letterToIndex[char];
                        if (targetIndex !== undefined && targetIndex < inputs.length) {
                            inputs[targetIndex].click();
                            clickCount++;
                            clickedThisQuestion = true;
                        }
                    }
                }

                if (clickedThisQuestion) {
                    questionBox.style.border = "2px dashed #4CAF50";
                } else {
                    questionBox.style.border = "2px dashed #F44336";
                }
            });

            logMsg(`🎉 客观题秒杀完成！共点击 ${clickCount} 个选项。`, 'success');

        } catch (error) {
            logMsg(`❌ 致命错误：${error}`, 'error');
            console.error(error);
        }

        btnObj.disabled = false;
    };

    // ==========================================
    // 功能 2：主观题处理（彻底剥离 JSON，逐题作答）
    // ==========================================
    btnSub.onclick = async function() {
        if (API_KEY === "这里填入你的DeepSeek_API_KEY" || API_KEY === "") {
            logMsg('❌ 缺少 API_KEY，请先在脚本内配置！', 'error');
            alert("请先在代码内配置 API Key！");
            return;
        }

        btnSub.disabled = true;
        logMsg('🔍 正在扫描主观题...', 'info');

        let allQuestionElements = [];
        findQuestionsInDocument(document, ".questionLi", allQuestionElements);

        let subQuestions = [];
        for (let i = 0; i < allQuestionElements.length; i++) {
            let questionBox = allQuestionElements[i];
            let inputs = Array.from(questionBox.querySelectorAll('.answerBg, [onclick*="addChoice"]'));
            if (inputs.length === 0) {
                subQuestions.push({ index: i, box: questionBox, text: questionBox.textContent.replace(/\s+/g, ' ').trim() });
            }
        }

        if (subQuestions.length === 0) {
            logMsg('⚠️ 当前页面未找到主观题(简答/填空)。', 'warn');
            btnSub.disabled = false;
            return;
        }

        logMsg(`✍️ 锁定 ${subQuestions.length} 道主观题，采用逐题深度思考模式。`, 'success');

        let answeredCount = 0;
        for (let i = 0; i < subQuestions.length; i++) {
            let q = subQuestions[i];
            logMsg(`⌛ 正在呼叫AI思考第 ${i + 1}/${subQuestions.length} 题...`, 'info');
            q.box.style.border = "2px dashed #FF9800";

            let prompt = `请解答这道题目：\n${q.text}`;
            try {
                let answerStr = await askAI(prompt, false);
                let textInjected = false;

                // 1. 富文本编辑器
                let textFrames = q.box.querySelectorAll('iframe');
                for (let frame of textFrames) {
                    try {
                        let frameDoc = frame.contentDocument || frame.contentWindow.document;
                        if (frameDoc && frameDoc.body) {
                            frameDoc.body.innerHTML = `<p style="line-height: 1.6; font-size: 14px; color: #333;">${answerStr.replace(/\n/g, '<br>')}</p>`;
                            textInjected = true;
                            break;
                        }
                    } catch(e) {}
                }

                // 2. 普通文本框
                if (!textInjected) {
                    let textInputs = q.box.querySelectorAll('textarea, input[type="text"]');
                    for (let t of textInputs) {
                        if (t.type !== 'hidden' && t.style.display !== 'none') {
                            t.value = answerStr;
                            t.dispatchEvent(new Event('input', { bubbles: true }));
                            t.dispatchEvent(new Event('change', { bubbles: true }));
                            textInjected = true;
                            break;
                        }
                    }
                }

                if (textInjected) {
                    answeredCount++;
                    q.box.style.border = "2px dashed #2196F3";
                    logMsg(`✅ 第 ${i + 1} 题已自动填入。`, 'success');
                } else {
                    q.box.style.border = "2px dashed #F44336";
                    logMsg(`⚠️ 第 ${i + 1} 题作答完成，但未找到输入框，请手动检查。`, 'warn');
                }

                // 防封控休眠
                await sleep(1000);
            } catch (error) {
                logMsg(`❌ 第 ${i + 1} 题处理失败: ${error}`, 'error');
                q.box.style.border = "2px dashed #F44336";
            }
        }

        logMsg(`🎉 主观题任务全部结束！成功完成 ${answeredCount} 题。`, 'success');
        btnSub.disabled = false;
    };
})();
