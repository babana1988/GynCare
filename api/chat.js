export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { prompt, mode = 'report_summary', consent_version = 'unknown' } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: '缺少 prompt 参数' });
  }

  const modeInstruction = {
    report_summary: '请仅做患者教育与就医沟通辅助，不做诊断或处方建议。',
    rehab_plan: '请仅提供生活方式与康复支持建议，不做个体化治疗决策。',
    symptom_weekly_summary: '请基于打卡数据做趋势总结与提醒，不做诊断结论。'
  }[mode] || '请输出健康教育辅助内容。';

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: modeInstruction },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || '请求失败' });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({
      text,
      mode,
      consent_version,
      generated_at: new Date().toISOString(),
      trace_id: crypto.randomUUID(),
      disclaimer: '本内容仅用于健康教育与就医沟通准备，不能替代医生面诊。'
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
}
