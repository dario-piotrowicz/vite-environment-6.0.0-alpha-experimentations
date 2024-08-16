import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData, json, useParams, Link } from '@remix-run/react';

export async function loader({ context }: LoaderFunctionArgs) {
  const cf = context.cloudflare.cf;

  return json({ cf, fields: Object.keys(cf) });
}

export default function Item() {
  const params = useParams<'field'>();
  const field = params['field']!;

  const { cf, fields } = useLoaderData<typeof loader>();

  return (
    <div>
      {field in cf ? (
        <>
          <p>
            <h1>CF property - {field}</h1>
            <h2>Value = {`${cf[field]}`}</h2>
          </p>
        </>
      ) : (
        <div>
          <h1>CF proprty &quot;{field}&quot; not found</h1>
        </div>
      )}
      <hr />
      <h2>Available CF properties</h2>
      <ul>
        {fields.map(f => (
          <li key={f}>
            <Link to={`/cf-fields/${f}`}>{f}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
