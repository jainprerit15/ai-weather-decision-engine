import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { question, weather } = await req.json();

    if (!question || !weather) {
      return NextResponse.json(
        { error: "Missing question or weather context." },
        { status: 400 }
      );
    }

    const openAiKey =
      process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

    if (!openAiKey) {
      return NextResponse.json(
        {
          error:
            "OpenAI key is not configured. Add OPENAI_API_KEY in your server environment."
        },
        { status: 500 }
      );
    }

    const prompt = `You are a weather decision assistant. Weather context: ${JSON.stringify(
      weather
    )}. User question: ${question}. Reply in 4-6 short lines with practical guidance and a confidence score out of 100.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt
      })
    });

    if (!response.ok) {
      const details = await response.text();
      return NextResponse.json(
        { error: `OpenAI request failed (${response.status}): ${details}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const answer =
      data?.output?.[0]?.content?.[0]?.text || "No answer generated.";

    return NextResponse.json({ answer });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
