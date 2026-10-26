export class AppError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acceso denegado") {
    super(message, 403);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Solicitud incorrecta") {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "No encontrado") {
    super(message, 404);
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return new Response(error.message, { status: error.status });
  }

  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === "ENOENT") return new Response("El elemento ya no existe", { status: 404 });
  if (code === "EEXIST") return new Response("Ya existe un elemento con ese nombre", { status: 409 });
  if (code === "EACCES" || code === "EPERM") return new Response("El sistema no permite acceder al elemento", { status: 403 });
  if (code === "ENOSPC") return new Response("No hay espacio suficiente en el disco", { status: 507 });
  if (error instanceof SyntaxError) return new Response("Datos de solicitud no válidos", { status: 400 });
  return new Response("No se pudo completar la operación. Revisa el servidor y vuelve a intentarlo.", { status: 500 });
}
