import type { JSX } from 'react';
import { ChannelView } from '@/features/channels/ChannelView';

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
  const { slug } = await params;
  return <ChannelView slug={slug} />;
}
