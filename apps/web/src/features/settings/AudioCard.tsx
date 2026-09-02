'use client';

import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Button, Field, Glass, Icon, Segmented, Select, Slider } from '@/ui';

import { pttKeyLabel, useMicTest } from '@/call';
import { useApp } from '@/features/shell/AppContext';
import styles from './cards.module.css';

const METER_BARS = 12;

type DeviceOption = { value: string; label: string };
type DeviceList = { inputs: DeviceOption[]; outputs: DeviceOption[] };

function toOptions(
  devices: MediaDeviceInfo[],
  kind: MediaDeviceKind,
  prefix: string,
): DeviceOption[] {
  const real = devices
    .filter((device) => device.kind === kind && device.deviceId.length > 0)
    .map((device, index) => ({
      value: device.deviceId,
      label: device.label.length > 0 ? device.label : `${prefix} ${index + 1}`,
    }));
  return [{ value: '', label: 'Padrão do sistema' }, ...real];
}

/** Sem permissão o browser esconde nomes e ids; um pedido rápido de áudio destrava a lista. */
async function ensureLabels(media: MediaDevices): Promise<void> {
  const list = await media.enumerateDevices();
  const hidden = list.some((d) => d.kind === 'audioinput' && d.label.length === 0);
  if (!hidden) return;
  try {
    const stream = await media.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
  } catch {
    // Permissão negada: a lista fica com nomes genéricos.
  }
}

/** Card "Dispositivos de áudio" (Settings.dc.html:120-176). Tudo local, nada vai para a API. */
export function AudioCard(): JSX.Element {
  const { audioPrefs, updateAudioPrefs } = useApp();
  const [devices, setDevices] = useState<DeviceList>({ inputs: [], outputs: [] });
  const [testing, setTesting] = useState(false);
  const mic = useMicTest(audioPrefs.inputDeviceId);

  useEffect(() => {
    const media = navigator.mediaDevices as MediaDevices | undefined;
    if (media === undefined) return;

    let alive = true;
    const load = async (): Promise<void> => {
      await ensureLabels(media);
      const list = await media.enumerateDevices();
      if (!alive) return;
      setDevices({
        inputs: toOptions(list, 'audioinput', 'Microfone'),
        outputs: toOptions(list, 'audiooutput', 'Saída'),
      });
    };

    const onChange = (): void => void load();
    void load();
    media.addEventListener('devicechange', onChange);
    return () => {
      alive = false;
      media.removeEventListener('devicechange', onChange);
    };
  }, []);

  const lit = Math.round(mic.level * METER_BARS);

  return (
    <Glass className={styles.card}>
      <span className={styles.cardLabel}>Dispositivos de áudio</span>

      <Select
        label="Entrada"
        icon={<Icon name="mic" size={17} />}
        options={devices.inputs}
        value={audioPrefs.inputDeviceId ?? ''}
        onChange={(event) => updateAudioPrefs({ inputDeviceId: event.target.value || null })}
        emptyLabel="Nenhum microfone"
      />

      <Select
        label="Saída"
        icon={<Icon name="headphones" size={17} />}
        options={devices.outputs}
        value={audioPrefs.outputDeviceId ?? ''}
        onChange={(event) => updateAudioPrefs({ outputDeviceId: event.target.value || null })}
        emptyLabel="Saída padrão do sistema"
      />

      <Slider
        label="Volume de saída"
        value={audioPrefs.outputVolume}
        onChange={(value) => updateAudioPrefs({ outputVolume: value })}
        valueLabel={`${Math.round(audioPrefs.outputVolume * 100)}`}
      />

      <Segmented
        label="Modo de entrada"
        value={audioPrefs.inputMode}
        onChange={(value) => updateAudioPrefs({ inputMode: value })}
        options={[
          { value: 'vad', label: 'Detecção de voz' },
          { value: 'ptt', label: 'Apertar pra falar' },
        ]}
      />

      {audioPrefs.inputMode === 'ptt' ? (
        <div className={styles.pttRow}>
          {/* Limite do browser: sem aba em foco não existe atalho global (decisão D12). */}
          <p className={styles.warning}>
            O apertar pra falar só funciona com a aba do King DC em foco.
          </p>
          <Field
            label="Tecla"
            value={pttKeyLabel(audioPrefs.pttKey)}
            readOnly
            onKeyDown={(event) => {
              // Tab segue navegando e ESC fecha o modal: nenhum dos dois é tecla de PTT.
              if (event.key === 'Tab' || event.key === 'Escape') return;
              event.preventDefault();
              updateAudioPrefs({ pttKey: event.code });
            }}
            placeholder="Clique e aperte uma tecla"
          />
        </div>
      ) : null}

      <div className={styles.testRow}>
        <Button
          variant="secondary"
          compact
          onClick={() => {
            if (testing) {
              mic.stop();
              setTesting(false);
              return;
            }
            mic.start();
            setTesting(true);
          }}
        >
          {testing ? 'Parar teste' : 'Testar microfone'}
        </Button>
        <div className={styles.meter} role="meter" aria-label="Nível do microfone">
          {Array.from({ length: METER_BARS }, (_unused, index) => (
            <span
              key={index}
              className={index < lit ? `${styles.bar} ${styles.barOn}` : styles.bar}
            />
          ))}
        </div>
      </div>
    </Glass>
  );
}
