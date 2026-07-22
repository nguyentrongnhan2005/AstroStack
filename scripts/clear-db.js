// Script xóa toàn bộ dữ liệu trong database (giữ nguyên cấu trúc bảng)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('Bắt đầu xóa toàn bộ dữ liệu...');

  // Xóa theo thứ tự từ bảng con -> bảng cha để tránh lỗi foreign key
  const deletedSignals = await prisma.coopSignal.deleteMany({});
  console.log(`✓ CoopSignal: đã xóa ${deletedSignals.count} bản ghi`);

  const deletedMembers = await prisma.lobbyMember.deleteMany({});
  console.log(`✓ LobbyMember: đã xóa ${deletedMembers.count} bản ghi`);

  const deletedLobbies = await prisma.coopLobby.deleteMany({});
  console.log(`✓ CoopLobby: đã xóa ${deletedLobbies.count} bản ghi`);

  const deletedMessages = await prisma.message.deleteMany({});
  console.log(`✓ Message: đã xóa ${deletedMessages.count} bản ghi`);

  const deletedFriendships = await prisma.friendship.deleteMany({});
  console.log(`✓ Friendship: đã xóa ${deletedFriendships.count} bản ghi`);

  const deletedPlacedCards = await prisma.placedCard.deleteMany({});
  console.log(`✓ PlacedCard: đã xóa ${deletedPlacedCards.count} bản ghi`);

  const deletedVersions = await prisma.scheduleVersion.deleteMany({});
  console.log(`✓ ScheduleVersion: đã xóa ${deletedVersions.count} bản ghi`);

  const deletedSessions = await prisma.session.deleteMany({});
  console.log(`✓ Session: đã xóa ${deletedSessions.count} bản ghi`);

  const deletedCards = await prisma.courseCard.deleteMany({});
  console.log(`✓ CourseCard: đã xóa ${deletedCards.count} bản ghi`);

  const deletedSemesters = await prisma.semester.deleteMany({});
  console.log(`✓ Semester: đã xóa ${deletedSemesters.count} bản ghi`);

  const deletedUsers = await prisma.user.deleteMany({});
  console.log(`✓ User: đã xóa ${deletedUsers.count} bản ghi`);

  console.log('\n✅ Đã xóa toàn bộ dữ liệu thành công! Cấu trúc bảng vẫn được giữ nguyên.');
  await prisma.$disconnect();
}

clearDatabase().catch(async (e) => {
  console.error('Lỗi:', e);
  await prisma.$disconnect();
  process.exit(1);
});
