/**
 * Hello-world Lambda response streaming proof for Function URLs.
 * The `awslambda` global is provided by the Node.js managed runtime; no import.
 *
 * Handler: index.handler
 */

/* global awslambda */

export const handler = awslambda.streamifyResponse(
  async (_event, responseStream, _context) => {
    const metadata = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    };

    responseStream = awslambda.HttpResponseStream.from(
      responseStream,
      metadata,
    );

    for (const chunk of ['hello', 'from', 'lambda', 'streaming']) {
      responseStream.write(`${chunk}\n`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    responseStream.end();
    await responseStream.finished();
  },
);
