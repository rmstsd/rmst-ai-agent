export const runtime = 'nodejs'

export let bookMarkList = []

export async function POST(request: Request) {
  bookMarkList = await request.json()

  return Response.json({ success: true })
}
