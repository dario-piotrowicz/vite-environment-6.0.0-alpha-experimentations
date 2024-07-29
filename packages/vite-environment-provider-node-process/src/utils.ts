interface ResponseObject {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export async function responseToObject(
  response: Response,
): Promise<ResponseObject> {
  const body = await response.text();
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    status: response.status,
    headers,
    body,
  };
}

export function objectToResponse({ body, ...rest }: ResponseObject): Response {
  return new Response(body, rest);
}
