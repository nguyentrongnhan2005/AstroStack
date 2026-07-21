import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(request: Request) {
  try {
    const groqApiKey = request.headers.get('x-groq-api-key') || process.env.GROQ_API_KEY || '';

    if (!apiKey && !groqApiKey) {
      return NextResponse.json({ error: 'API Key cho Gemini hoặc Groq chưa được cấu hình. Vui lòng cấu hình ở file .env hoặc điền trên UI Cài đặt.' }, { status: 500 });
    }

    const { message, courseCards, versions } = await request.json();

    if (!message || message.trim() === '') {
      return NextResponse.json({ error: 'Nội dung tin nhắn trống' }, { status: 400 });
    }

    // Tạo context thông tin TKB hiện tại để AI hiểu ngữ cảnh
    const scheduleContext = {
      courseCards: (courseCards || []).map((card: any) => ({
        subjectCode: card.subjectCode,
        subjectName: card.subjectName,
        classCode: card.classCode,
        teacher: card.teacher,
        sessions: (card.sessions || []).map((s: any) => ({
          dayOfWeek: s.dayOfWeek,
          startPeriod: s.startPeriod,
          endPeriod: s.endPeriod,
          room: s.room,
          weekParity: s.weekParity,
          sessionType: s.sessionType
        }))
      })),
      versions: (versions || []).map((v: any) => ({
        label: v.label,
        placedCardsCount: (v.placedCards || []).length
      }))
    };

    const systemInstruction = `
      Bạn là "Leo" - Trợ lý phi hành gia ảo thông thái chuyên về quản lý và tối ưu hóa thời khóa biểu học tập của dự án CardTKB.
      Phong cách trò chuyện của bạn:
      - Luôn thân thiện, hào hứng, sử dụng các thuật ngữ liên quan đến vũ trụ, phi hành gia, trạm không gian, hệ mặt trời (ví dụ: "Chào phi hành gia!", "Quỹ đạo học tập của bạn...", "Báo cáo từ cabin điều khiển...").
      - Trả lời bằng tiếng Việt ngắn gọn, dễ hiểu và dí dỏm.
      - Bạn hiểu rõ cấu trúc thời khóa biểu được cung cấp trong phần Ngữ cảnh bên dưới.
      
      Ngữ cảnh thời khóa biểu hiện tại của người dùng:
      ${JSON.stringify(scheduleContext, null, 2)}
      
      Nhiệm vụ của bạn:
      - Trả lời các câu hỏi thắc mắc của người dùng về thời khóa biểu hiện tại (ví dụ: Thứ mấy học môn gì, rảnh buổi nào).
      - Phát hiện và cảnh báo nếu có môn học nào bị trùng lịch (sessions chồng chéo nhau cùng thứ và cùng tiết học).
      - Đưa ra lời khuyên tối ưu hóa lịch học thông minh (ví dụ: "Dồn môn học về các ngày đầu tuần để giải phóng năng lượng vào cuối tuần!", "Lịch học của bạn đang rất cân bằng").
      - Nếu người dùng hỏi chuyện phiếm, hãy vui vẻ trò chuyện với tư cách phi hành gia đang trôi lơ lửng ngoài vũ trụ.
    `;

    // 1. Nếu có Groq API Key, ưu tiên sử dụng Groq (Llama 3.3 70B siêu tốc)
    if (groqApiKey) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: message }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Groq API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const replyText = data.choices[0]?.message?.content || '';

      return NextResponse.json({
        success: true,
        reply: replyText,
        provider: 'groq'
      });
    }

    // 2. Fallback sử dụng Gemini
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction,
    });

    const result = await model.generateContent(message);
    const replyText = result.response.text();

    return NextResponse.json({
      success: true,
      reply: replyText,
      provider: 'gemini'
    });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi xử lý yêu cầu AI' }, { status: 500 });
  }
}
