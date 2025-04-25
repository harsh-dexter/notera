import asyncio
from fastapi import WebSocket
import json
from typing import List, Dict, Any

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connected: {websocket.client}. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"WebSocket disconnected: {websocket.client}. Total connections: {len(self.active_connections)}")
        else:
            print(f"Attempted to disconnect an unknown websocket: {websocket.client}")


    async def broadcast(self, message: Dict[str, Any]):
        """Broadcasts a JSON message to all connected clients."""
        disconnected_websockets = []
        message_json = json.dumps(message)
        print(f"Broadcasting message: {message_json}")

        # Create a copy of the active connections list *before* starting sends
        current_connections = list(self.active_connections)

        if not current_connections:
            print("No active connections to broadcast to.")
            return

        # Use asyncio.gather for concurrent sending to the copied list
        tasks = [self._send_personal_message(websocket, message_json) for websocket in current_connections]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle disconnections based on the results and the copied list
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                # Get the websocket from the copied list used for tasks
                websocket = current_connections[i]
                print(f"Error sending to {websocket.client}: {result}. Marking for disconnection.")
                disconnected_websockets.append(websocket)

        # Remove disconnected clients after iteration
        for websocket in disconnected_websockets:
            self.disconnect(websocket)

    async def _send_personal_message(self, websocket: WebSocket, message: str):
        """Sends a message to a single websocket, handling potential errors."""
        try:
            await websocket.send_text(message)
        except Exception as e:
            # Don't disconnect here, just raise the exception to be handled by broadcast
            raise e

# Create a single instance of the manager to be used across the application
manager = ConnectionManager()
