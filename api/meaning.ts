import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { phrase } = await req.json();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const result = await model.generateContent(`"${phrase}"의 한국어 뜻을 간결하게 알려주세요. 뜻만 답하세요. 예: "~를 기대하다"`);

    return new Response(JSON.stringify({ meaning: result.response.text().trim() }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "뜻 조회 실패" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
