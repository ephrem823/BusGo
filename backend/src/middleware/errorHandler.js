export function errorHandler(err, req, res, next) {
  console.error(err);
  let status = err.status ?? 500;
  let message = err.message ?? "Internal server error";

  if (err.name === "ZodError") {
    status = 400;
    message = err.issues?.map((i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`).join("; ") || "Invalid input data";
  } else if (err.code === "P2002") {
    status = 409;
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : err.meta?.target || "field";
    message = `A record with this ${target} already exists.`;
  } else if (err.code === "P2025") {
    status = 404;
    message = "Requested record not found.";
  } else if (err.code === "P2003") {
    status = 409;
    message = "Operation failed due to related records constraint.";
  } else if (status === 500) {
    message = "Internal server error";
  }

  res.status(status).json({ error: message });
}

export function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}

