import { Resvg } from '@resvg/resvg-js';
import type { RequestHandler } from './$types';
import ogJourneySvg from '../../../static/og-journey.svg?raw';
import ogBoldSvg from '../../../static/og-bold.svg?raw';

const svgMap: Record<string, string> = {
	journey: ogJourneySvg,
	bold: ogBoldSvg
};

export const GET: RequestHandler = async ({ url }) => {
	const style = url.searchParams.get('style') || 'journey';
	const svg = svgMap[style] ?? svgMap.journey;

	const resvg = new Resvg(svg, {
		fitTo: { mode: 'width', value: 1200 }
	});

	const pngData = resvg.render();
	const pngBuffer = pngData.asPng();

	return new Response(pngBuffer, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=86400, s-maxage=604800'
		}
	});
};
