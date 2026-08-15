import asyncio
import websockets

async def test():
    try:
        print("Connecting...")
        async with websockets.connect('ws://127.0.0.1:8000/api/ws/camera/3') as ws:
            print('Connected!')
            await ws.send('{"image": ""}')
            res = await ws.recv()
            print('Response:', res)
    except Exception as e:
        print('Error:', e)

asyncio.run(test())
