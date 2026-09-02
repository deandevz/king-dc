# How many people each VPS handles

[Versão em português](CAPACIDADE.md)

**This is an assumption.** The numbers come from LiveKit's official benchmark and media presets,
extrapolated down to small machines. Nobody has measured a 1 vCPU VPS with 80 people in a call. The
right thing to do is measure real usage with `docker stats` and the provider's traffic graph during a
full call. If you run King DC with a bigger group and have numbers, open an issue with them: that is
what this page is missing.

## How the numbers are calculated

| Measure | Rule |
|---|---|
| Voice streams LiveKit forwards | ~240 per vCPU. From the [official benchmark](https://docs.livekit.io/transport/self-hosting/benchmark/): 16 vCPU handle ~3,000 audio subscriptions at 80% CPU |
| Absolute peak in call | everyone talking at once, in rooms of 6. Each person costs 5 streams |
| Normal use in call | 1.7× the peak: half the people silent at any moment, and Opus does not transmit silence |
| Open tabs before the API strains | ~120 per vCPU with the current 2 s polling. Above ~150 tabs, polling must become push (SSE). That is software, not hardware |
| Registered community | 5× normal use: 10 to 15% of members in voice at peak, typical for gaming communities |
| Screen-share viewer hours per day | monthly allowance ÷ 30 ÷ 0.84 GB. One viewer at 720p30 costs 2 Mbps |
| Simultaneous streams | how many 5-viewer streams fit 4 h per day, every day, within the allowance |

Why "N × (N−1)": in a room of N people, each sends 1 stream and receives N−1. One room of 20 is 380
streams; the same 20 people in 4 rooms of 5 is 80. Small rooms cost almost 5 times less.

## Table, cheapest to priciest

Prices as of September 2026, approximate. On Vultr, São Paulo carries a surcharge over the base price of the same
machine in the US: the reference box costs US$ 8 outside São Paulo and US$ 18 there.

| VPS | Region | Price/month | vCPU / RAM / bandwidth | Absolute peak in call | Normal use in call | Open tabs | Community | Screen: viewer h/day | 5-viewer streams, 4 h/day |
|---|---|---|---|---|---|---|---|---|---|
| Vultr HP vhp-1c-1gb | US / SP | US$ 6 / 9 | 1 / 1 GB / 2 TB | 48 | 80 | 120 | 400 | 79 | 4 |
| Hetzner CPX22 | US / EU | € 8 | 2 / 4 GB / 20 TB | 96 | 160 | 240 | 800 | 794 | 40 |
| Vultr HP vhp-1c-2gb | US / SP | US$ 8 / 18 | 1 / 2 GB / 3 TB | 48 | 80 | 120 | 400 | 119 | 6 |
| Hetzner CPX32 | US / EU | € 15 | 4 / 8 GB / 20 TB | 192 | 325 | 480 | 1,600 | 794 | 40 |
| Vultr HP vhp-2c-2gb | US / SP | US$ 18 / 27 | 2 / 2 GB / 4 TB | 96 | 160 | 240 | 800 | 159 | 8 |
| Hostinger KVM 8 | EU / BR | € 22 promo, € 50 renewal | 8 / 32 GB / 32 TB | 384 | 650 | 960 | 3,200 | 1,270 | 63 |
| DigitalOcean / Linode 4 GB | US | US$ 24 | 2 / 4 GB / 4 TB | 96 | 160 | 240 | 800 | 159 | 8 |
| Vultr HP vhp-2c-4gb | US / SP | US$ 24 / 36 | 2 / 4 GB / 5 TB | 96 | 160 | 240 | 800 | 198 | 10 |
| Oracle E4 Flex | SP | ~US$ 42 | 2 OCPU / 4 GB / 10 TB | 96 | 160 | 240 | 800 | 397 | 20 |
| Vultr HP vhp-4c-8gb | US / SP | US$ 48 / 72 | 4 / 8 GB / 6 TB | 192 | 325 | 480 | 1,600 | 238 | 12 |
| Vultr HP vhp-8c-16gb | US / SP | US$ 96 / 144 | 8 / 16 GB / 8 TB | 384 | 650 | 960 | 3,200 | 317 | 16 |

The reference deployment runs on the `vhp-1c-2gb` row in São Paulo.

## What gives out first

1. **The monthly bandwidth allowance**, if the group streams screens. Voice alone barely registers:
   240 full streams are 12 Mbps, 5.4 GB per hour.
2. **The API with many open tabs**, because of the 2 s presence polling. Switching to push fixes it
   without a bigger machine.
3. **LiveKit CPU**, last. It only copies packets, it never transcodes.

## Assumptions that may be wrong

- **240 streams per vCPU.** LiveKit's benchmark is from 2021 on dedicated server CPUs. A shared VPS
  vCPU may yield less; a recent AMD may yield more.
- **Half silent.** Reasonable for gaming calls. In a meeting with one person talking the whole time,
  normal use approaches the peak.
- **10 to 15% in voice at peak.** A small, active community exceeds it; a large, dormant one sits
  well below.
- **2 Mbps per viewer.** That is the `h720fps30` preset. Static content (code, slides) costs less
  because the encoder trims; fast-moving games sit at the ceiling.
- **1 GB of RAM** runs the stack but cannot build the images on the VPS itself without swap.
- **Latency** is not in the table: US and EU add 120 to 150 ms for anyone in South America. Usable,
  like Discord's US region, but worse for gaming.

## Configuration limits

- `max_participants: 30` per room in `infra/livekit.yaml`. Adjustable.
- Presence polling: `PRESENCE_POLL_MS` in `packages/contracts`.
- Screen preset: 1280×720 at 30 fps and 2 Mbps, fixed in `apps/web/src/call`.

## Where the screen-share cost comes from

The LiveKit SDK screen-share preset is `h720fps30`: 1280×720, 30 fps, 2.0 Mbps. In an SFU every
viewer gets its own copy, so the server spends 2 Mbps of egress per viewer:
2,000,000 × 3,600 ÷ 8 ÷ 1024³ ≈ 0.84 GB per hour. Ten people with one presenting and nine
watching is 7.5 GB per hour of screen alone. Audio is negligible next to that: 0.1 Mbps per stream.

There is no 60 fps preset in the SDK. Using the ratio YouTube applies between 720p30 and 720p60, it
would be 1.5 times the bandwidth, which is why the screen is fixed at 30. If bandwidth gets tight,
`h720fps15` (1.5 Mbps) cuts 25% without changing resolution, and it is a client parameter, not infra.

Providers with a São Paulo region: Vultr, Magalu Cloud and Oracle. DigitalOcean and Contabo have no
datacenter in Brazil. Magalu charges R$ 0.10 per GiB of egress from the first byte, which makes it
the most expensive of the three under heavy use. Oracle includes 10 TB per month, but its free tier
loses capacity without notice and is not fit for production.
