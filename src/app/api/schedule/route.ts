import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma, ScheduleVersion, PlacedCard } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 1. Tìm hoặc tạo User & Semester mặc định
    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: { semesters: true }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@cardtkb.local`,
          university: 'IT University',
        },
        include: { semesters: true }
      });
    }

    let semester = user.semesters[0];
    if (!semester) {
      semester = await prisma.semester.create({
        data: {
          userId: user.id,
          name: 'HK1 2026-2027',
        }
      });
    }

    // 2. Lấy dữ liệu môn học & các phiên bản
    const courseCards = await prisma.courseCard.findMany({
      where: { semesterId: semester.id },
      include: { sessions: true }
    });

    const rawVersions = await prisma.scheduleVersion.findMany({
      where: { semesterId: semester.id },
      include: { placedCards: true }
    });

    // Định dạng lại các versions theo đúng structure của Zustand
    const versions = rawVersions.map((v: ScheduleVersion & { placedCards: PlacedCard[] }) => ({
      id: v.id,
      semesterId: v.semesterId,
      label: v.label,
      placedCards: v.placedCards.map((pc: PlacedCard) => ({
        id: pc.id,
        scheduleVersionId: pc.scheduleVersionId,
        courseCardId: pc.courseCardId,
        locked: pc.locked,
      })),
    }));

    return NextResponse.json({
      courseCards,
      versions,
    });
  } catch (error: any) {
    console.error('Error in GET /api/schedule:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, courseCards, versions } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 1. Tìm hoặc tạo User & Semester mặc định
    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: { semesters: true }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@cardtkb.local`,
          university: 'IT University',
        },
        include: { semesters: true }
      });
    }

    let semester = user.semesters[0];
    if (!semester) {
      semester = await prisma.semester.create({
        data: {
          userId: user.id,
          name: 'HK1 2026-2027',
        }
      });
    }

    const semId = semester.id;

    // 2. Dọn dẹp và nạp dữ liệu bằng Transaction để đảm bảo tính toàn vẹn dữ liệu
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Xóa tất cả các CourseCard cũ (đồng thời xóa Session và PlacedCard tương ứng do onDelete: Cascade)
      await tx.courseCard.deleteMany({
        where: { semesterId: semId }
      });

      // Xóa các ScheduleVersion cũ
      await tx.scheduleVersion.deleteMany({
        where: { semesterId: semId }
      });

      // Tạo các CourseCard mới
      for (const card of courseCards) {
        await tx.courseCard.create({
          data: {
            id: card.id,
            semesterId: semId,
            subjectCode: card.subjectCode,
            subjectName: card.subjectName,
            classCode: card.classCode,
            teacher: card.teacher || 'Chưa rõ',
            slotsLeft: card.slotsLeft || 40,
            colorRamp: card.colorRamp || 'blue',
            sourceType: card.sourceType || 'import',
            sessions: {
              create: card.sessions.map((sess: any) => ({
                id: sess.id,
                dayOfWeek: sess.dayOfWeek,
                startPeriod: sess.startPeriod,
                endPeriod: sess.endPeriod,
                room: sess.room || 'TBA',
                weekParity: sess.weekParity || 'all',
                sessionType: sess.sessionType || 'theory',
              }))
            }
          }
        });
      }

      // Tạo các ScheduleVersion mới
      for (const ver of versions) {
        let versionId = ver.id;
        
        // Phòng thủ trùng ID khóa chính: Nếu ID là mặc định cũ hoặc bị trùng với user khác trong DB
        if (versionId === 'default-version') {
          versionId = `version-default-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        } else {
          const duplicate = await tx.scheduleVersion.findFirst({
            where: {
              id: versionId,
              semesterId: { not: semId }
            }
          });
          if (duplicate) {
            versionId = `version-dup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          }
        }

        // Tạo PlacedCard với ID an toàn không trùng lặp
        const safePlacedCards = [];
        for (const pc of ver.placedCards) {
          let pcId = pc.id;
          // Nếu ID PlacedCard có định dạng dễ trùng (placed-subjectCode) hoặc bị trùng trong DB của user khác
          const isLegacyFormat = pcId.startsWith('placed-') && pcId.split('-').length <= 2;
          if (isLegacyFormat) {
            pcId = `placed-${pc.courseCardId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          } else {
            const dupCard = await tx.placedCard.findFirst({
              where: {
                id: pcId,
                scheduleVersion: {
                  semesterId: { not: semId }
                }
              }
            });
            if (dupCard) {
              pcId = `placed-${pc.courseCardId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            }
          }
          safePlacedCards.push({
            id: pcId,
            courseCardId: pc.courseCardId,
            locked: pc.locked || false,
          });
        }

        await tx.scheduleVersion.create({
          data: {
            id: versionId,
            semesterId: semId,
            label: ver.label,
            placedCards: {
              create: safePlacedCards
            }
          }
        });
      }
    }, {
      maxWait: 15000,
      timeout: 35000
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in POST /api/schedule:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
