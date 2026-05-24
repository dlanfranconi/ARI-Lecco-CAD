function connectReviewWs() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${proto}://${location.host}/ws/review`);
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "pending_bulletin") {
      alert("New bulletin pending dispatch review.");
    }
  };
  socket.onclose = () => setTimeout(connectReviewWs, 3000);
}

connectReviewWs();

