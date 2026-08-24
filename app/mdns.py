import socket

from zeroconf import ServiceInfo
from zeroconf.asyncio import AsyncZeroconf


def local_ip() -> str:
    # Doesn't actually send anything — just asks the OS which interface
    # would be used to reach an external address, to find our LAN IP.
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def build_info(hostname: str, port: int) -> ServiceInfo:
    return ServiceInfo(
        "_http._tcp.local.",
        f"ARI Lecco CAD ({hostname})._http._tcp.local.",
        addresses=[socket.inet_aton(local_ip())],
        port=port,
        properties={"path": "/"},
        server=f"{hostname}.local.",
    )


async def register(hostname: str, port: int) -> tuple[AsyncZeroconf, ServiceInfo]:
    aiozc = AsyncZeroconf()
    info = build_info(hostname, port)
    await aiozc.async_register_service(info)
    return aiozc, info


async def unregister(aiozc: AsyncZeroconf, info: ServiceInfo) -> None:
    await aiozc.async_unregister_service(info)
    await aiozc.async_close()
