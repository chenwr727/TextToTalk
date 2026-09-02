import { useState } from "react";
import type { VideoParams } from "../types";

const EXAMPLES: { t: string; p: string }[] = [
  { t: "科普·讲原理", p: "请用通俗易懂的方式解释：为什么手机放枕头边充电不推荐。开头先让观众心头一紧（比如一句：这个随手一放的习惯，可能在悄悄给你的床铺埋雷）。再讲大家熟悉的现象：手机充电发烫、被子捂热散热难；用一个柱状图对比「正常充电 vs 枕头遮挡」下的热量散失差别；然后用一个流程图或结构图，把锂电池热失控的连锁反应（隔膜熔化→正负极短路→爆燃）画清楚；再给一个能量量级（如 60℃、温度超过掌心能烫红），说明热失控有多难扑灭。最后落到可执行的安全建议：放到通风处、别让手机陪你过夜。" },
  { t: "商业·讲增长", p: "做一期「一款 App 如何从 0 到 100 万用户」的讲解。先讲增长其实不是一条直线，而是分阶段的曲线，用一张折线图把这一过程展示出来：冷启动、快速成长、平台期三个阶段。再讲清背后的漏斗模型：获客→激活→留存→变现，每一层都在流失，用一张层次金字塔图（或手绘结构图）把每层最后剩多少明确标出来，比如 100%→60%→35%→15%，让观众一眼看出流失真相。最后落到可执行的行动建议：先聚焦核心活跃用户、把留存做扎实，再谈拉新。" },
  { t: "健康·讲习惯", p: "讲「为什么早睡早起的人精力更好」。先用一个循环图把睡眠和精力的正向闭环讲清楚：睡得好→白天精力足→做事效率高→晚上更早入睡→睡得更好。再用一张对比图，把「熬夜 vs 早睡」的生理差异分开：一边是熬夜皮质醇升高、晨起昏沉、生物钟失序；另一边是早睡褪黑素稳定、深层睡眠足、醒来神清气爽。接着讲生物钟这个机制，用结构图说明熬夜如何让它失序、早睡如何让它同步。最后给可循序渐进的作息调整建议，结尾落在「从今晚我就开始调整」的行动号召。" },
  { t: "干货·讲流程", p: "讲一位新手如何从零开始学编程，把五步学习路径用一张流程图/步骤图一次讲清楚：① 确定目标语言（做网页学 JavaScript、做数据分析学 Python、开发 App 学 Swift）→ ② 搭建环境（编辑器、编译器、包管理）→ ③ 打基础（变量、循环、函数、数据结构）→ ④ 做小项目（计算器、待办清单）→ ⑤ 复盘迭代（重构、加功能、优化）。其中第①步用一张对比卡片或三张并列卡片展示三种选择；第④步用一张结构图把「输入→处理→输出」串起来。最后给明确的行动号召：今天就挑一个小项目动手。" },
];

export function ScriptInput({
  prompt,
  params,
  submitting,
  error,
  onPromptChange,
  onParamsChange,
  onSubmit,
}: {
  prompt: string;
  params: VideoParams;
  submitting?: boolean;
  error?: string;
  onPromptChange: (v: string) => void;
  onParamsChange: (p: VideoParams) => void;
  onSubmit: (prompt: string, params: VideoParams) => void;
}) {
  const submit = () => {
    if (!prompt.trim() || submitting) return;
    onSubmit(prompt.trim(), params);
  };

  const [goalOpen, setGoalOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);

  return (
    <div className="dsh-script">
      <div className="dsh-card dsh-script-card">
        <h1 className="dsh-script-title">请输入讲解文案</h1>
        <p className="dsh-script-sub">
          粘贴一段文案、一个网页链接，或点示例。AI 会自动拆成 PPT 式分镜，再生成带配音、配乐与字幕的讲解视频。
        </p>

        <div className="dsh-examples">
          {EXAMPLES.map((e) => (
            <button
              key={e.t}
              onClick={() => onPromptChange(e.p)}
              className="dsh-example"
              title={e.p}
            >
              ✦ {e.t}
            </button>
          ))}
        </div>

        <label className="dsh-label">文案</label>
        <textarea
          className="dsh-field"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={7}
          placeholder="粘贴讲解文案，或输入网页链接（如 https://example.com/article），AI 会自动抓取内容生成大纲"
        />
        <div className="dsh-count">{prompt.length} 字</div>

        <div className="dsh-accordion">
          <button
            onClick={() => setGoalOpen((v) => !v)}
            className="dsh-accordion-head"
            data-open={goalOpen}
          >
            <span>🎯 沟通目标（可选）</span>
            <span className="dsh-chev">▼</span>
          </button>

          {goalOpen && (
            <div className="dsh-accordion-body dsh-grid-2">
              <div>
                <div className="dsh-param-label">目标受众</div>
                <input
                  className="dsh-field"
                  value={params.audience ?? ""}
                  onChange={(e) => onParamsChange({ ...params, audience: e.target.value })}
                  placeholder="如：零基础新手 / 产品经理 / 中学生"
                />
              </div>
              <div>
                <div className="dsh-param-label">核心信息</div>
                <input
                  className="dsh-field"
                  value={params.coreMessage ?? ""}
                  onChange={(e) => onParamsChange({ ...params, coreMessage: e.target.value })}
                  placeholder="整片最想让观众记住的一句话"
                />
              </div>
              <div>
                <div className="dsh-param-label">观众收获</div>
                <input
                  className="dsh-field"
                  value={params.audienceOutcome ?? ""}
                  onChange={(e) => onParamsChange({ ...params, audienceOutcome: e.target.value })}
                  placeholder="观众看完能做什么 / 收获什么"
                />
              </div>
            </div>
          )}

          <button
            onClick={() => setGenOpen((v) => !v)}
            className="dsh-accordion-head"
            data-open={genOpen}
          >
            <span>⚙️ 生成参数</span>
            <span className="dsh-chev">▼</span>
          </button>

          {genOpen && (
            <div className="dsh-accordion-body">
              <div className="dsh-grid-2">
                <div>
                  <div className="dsh-param-label">讲解语气</div>
                  <select className="dsh-field" value={params.tone} onChange={(e) => onParamsChange({ ...params, tone: e.target.value as any })}>
                    <option value="formal">🎓 正式严谨</option>
                    <option value="casual">😄 轻松易懂</option>
                    <option value="energetic">🔥 活泼有感染力</option>
                  </select>
                </div>
                <div>
                  <div className="dsh-param-label">拆稿粒度</div>
                  <select className="dsh-field" value={params.granularity} onChange={(e) => onParamsChange({ ...params, granularity: e.target.value as any })}>
                    <option value="coarse">粗（页少）</option>
                    <option value="medium">中</option>
                    <option value="fine">细（页多）</option>
                  </select>
                </div>
                <div>
                  <div className="dsh-param-label">画幅</div>
                  <select className="dsh-field" value={`${params.width}x${params.height}`} onChange={(e) => {
                    const [w, h] = e.target.value.split("x").map(Number);
                    onParamsChange({ ...params, width: w, height: h });
                  }}>
                    <option value="1920x1080">16:9 横屏 1920×1080</option>
                  </select>
                </div>
                <div>
                  <div className="dsh-param-label">主题风格</div>
                  <select className="dsh-field" value={params.theme ?? "tech"} onChange={(e) => onParamsChange({ ...params, theme: e.target.value as any })}>
                    <option value="tech">🔵 科技蓝</option>
                    <option value="business">💼 商务蓝</option>
                    <option value="fresh">🌿 清新绿</option>
                    <option value="warm">🟠 暖橙</option>
                    <option value="dark">🌌 深空</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <div className="dsh-error">{error}</div>}
        <button
          onClick={submit}
          disabled={!prompt.trim() || submitting}
          className="dsh-btn dsh-submit"
        >
          {submitting ? "⏳ 正在生成大纲…" : "✨ 生成大纲 →"}
        </button>
      </div>
    </div>
  );
}