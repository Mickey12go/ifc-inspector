/**
 * Vercel Serverless Function — POST /api/advise
 *
 * Sends the QA report JSON to the OpenAI Responses API and returns
 * 3 plain-language improvement suggestions in Chinese.
 *
 * The API key is read exclusively from the OPENAI_API_KEY environment
 * variable configured in the Vercel dashboard — it never appears in
 * frontend code or the git history. When the key is missing the function
 * responds with { configured: false } so the UI can show a friendly hint.
 */

interface VercelLikeRequest {
  method?: string;
  body?: unknown;
}

interface VercelLikeResponse {
  status(code: number): VercelLikeResponse;
  json(payload: unknown): void;
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(200).json({ configured: false, advice: "" });
    return;
  }

  const reportJson = JSON.stringify(req.body ?? {}).slice(0, 12000);

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-6-astra",
        input: [
          {
            role: "system",
            content:
              "你是建筑信息模型（BIM）交付顾问。根据用户提供的 IFC 质检报告 JSON，" +
              "用简体中文、面向非技术用户，输出恰好 3 条可操作的改进建议。" +
              "每条建议不超过 60 字，按优先级排序，用「1. 2. 3.」编号，不要输出其他内容。",
          },
          { role: "user", content: reportJson },
        ],
      }),
    });

    if (!upstream.ok) {
      res.status(502).json({ error: "upstream_error", status: upstream.status });
      return;
    }

    const data = (await upstream.json()) as { output_text?: string };
    res.status(200).json({ configured: true, advice: data.output_text ?? "" });
  } catch {
    res.status(500).json({ error: "internal_error" });
  }
}
