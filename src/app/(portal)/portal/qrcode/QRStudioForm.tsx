'use client';

import type { QRCodeOptions, QRDotsType, QRCornersSquareType, QRCornersDotType } from '@/lib/qrCodeStyling';
import styles from './qrstudio.module.css';

const dotStyles: QRDotsType[] = ['rounded', 'dots', 'square', 'extra-rounded', 'classy', 'classy-rounded'];
const cornerSquareStyles: QRCornersSquareType[] = ['extra-rounded', 'square', 'dot'];
const cornerDotStyles: QRCornersDotType[] = ['dot', 'square'];

function updateCustomIcon(file: File | undefined, options: QRCodeOptions, setOptions: (o: QRCodeOptions) => void) {
  if (!file) {
    setOptions({ ...options, customIcon: null, icon: options.icon === 'custom' ? 'none' : options.icon });
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    setOptions({ ...options, customIcon: typeof reader.result === 'string' ? reader.result : null, icon: 'custom' });
  };
  reader.readAsDataURL(file);
}

export default function QRStudioForm({
  options,
  setOptions,
}: {
  options: QRCodeOptions;
  setOptions: (o: QRCodeOptions) => void;
}) {
  return (
    <div className={styles.formPanel}>
      <div className={styles.formHeader}>
        <p className={styles.eyebrow}>QR Studio</p>
        <h1 className={styles.formTitle}>Compose your QR code</h1>
        <p className={styles.formSub}>
          Tune the payload, size, module styling, and icon treatment. Triton Gaming logo presets stay
          available, and you can also upload a custom center icon.
        </p>
      </div>

      <div className={styles.grid}>
        <div className={styles.col}>
          <label className={styles.field}>
            <span className={styles.label}>Destination URL or text</span>
            <input
              className={styles.input}
              value={options.data}
              onChange={(e) => setOptions({ ...options, data: e.target.value })}
              placeholder="https://example.com"
            />
          </label>

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.label}>Size (px)</span>
              <input
                className={styles.input}
                type="number"
                min={160}
                max={1200}
                step={20}
                value={options.size}
                onChange={(e) => setOptions({ ...options, size: Number.parseInt(e.target.value, 10) || 0 })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Outer margin</span>
              <input
                className={styles.input}
                type="number"
                min={0}
                max={64}
                step={2}
                value={options.margin}
                onChange={(e) => setOptions({ ...options, margin: Number.parseInt(e.target.value, 10) || 0 })}
              />
            </label>
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.label}>Background</span>
              <input
                className={styles.colorInput}
                type="color"
                value={options.bgColor}
                onChange={(e) => setOptions({ ...options, bgColor: e.target.value })}
                disabled={options.transparentBg}
              />
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={options.transparentBg}
                  onChange={(e) => setOptions({ ...options, transparentBg: e.target.checked })}
                />
                Transparent
              </label>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Main module base</span>
              <input
                className={styles.colorInput}
                type="color"
                value={options.dotsColor}
                onChange={(e) => setOptions({ ...options, dotsColor: e.target.value })}
              />
            </label>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionCardHeader}>
              <div>
                <p className={styles.sectionCardTitle}>TG radial gradient</p>
                <p className={styles.sectionCardHint}>Keep the original Triton Gaming module gradient as the default look.</p>
              </div>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={options.dotsGradientEnabled}
                  onChange={(e) => setOptions({ ...options, dotsGradientEnabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>

            {options.dotsGradientEnabled && (
              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>Gradient start</span>
                  <input
                    className={styles.colorInput}
                    type="color"
                    value={options.dotsGradientStartColor}
                    onChange={(e) => setOptions({ ...options, dotsGradientStartColor: e.target.value })}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Gradient end</span>
                  <input
                    className={styles.colorInput}
                    type="color"
                    value={options.dotsGradientEndColor}
                    onChange={(e) => setOptions({ ...options, dotsGradientEndColor: e.target.value })}
                  />
                </label>
              </div>
            )}
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.label}>Corner frame color</span>
              <input
                className={styles.colorInput}
                type="color"
                value={options.cornersSquareColor}
                onChange={(e) => setOptions({ ...options, cornersSquareColor: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Corner dot color</span>
              <input
                className={styles.colorInput}
                type="color"
                value={options.cornersDotColor}
                onChange={(e) => setOptions({ ...options, cornersDotColor: e.target.value })}
              />
            </label>
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.label}>Module shape</span>
              <select
                className={styles.input}
                value={options.dotsType}
                onChange={(e) => setOptions({ ...options, dotsType: e.target.value as QRDotsType })}
              >
                {dotStyles.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Center icon preset</span>
              <select
                className={styles.input}
                value={options.icon}
                onChange={(e) => setOptions({ ...options, icon: e.target.value as QRCodeOptions['icon'] })}
              >
                <option value="tg-color">TG logo</option>
                <option value="tg-minimal">TG logo small</option>
                <option value="website">Website</option>
                <option value="link">Link</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="location">Location</option>
                <option value="wifi">Wi-Fi</option>
                <option value="none">No icon</option>
                <option value="custom">Custom upload</option>
              </select>
            </label>
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.label}>Corner frame style</span>
              <select
                className={styles.input}
                value={options.cornersSquareType}
                onChange={(e) => setOptions({ ...options, cornersSquareType: e.target.value as QRCornersSquareType })}
              >
                {cornerSquareStyles.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Corner dot style</span>
              <select
                className={styles.input}
                value={options.cornersDotType}
                onChange={(e) => setOptions({ ...options, cornersDotType: e.target.value as QRCornersDotType })}
              >
                {cornerDotStyles.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Custom icon upload</span>
            <input
              className={styles.fileInput}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => updateCustomIcon(e.target.files?.[0], options, setOptions)}
            />
            <span className={styles.hint}>Uploading an image automatically switches the QR code to the custom icon option.</span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Icon padding</span>
            <div className={styles.rangeRow}>
              <input
                className={styles.range}
                type="range"
                min={0}
                max={24}
                step={1}
                value={options.iconPadding}
                onChange={(e) => setOptions({ ...options, iconPadding: Number.parseInt(e.target.value, 10) })}
                disabled={options.icon === 'none'}
              />
              <span className={styles.rangeValue}>{options.iconPadding}px</span>
            </div>
            <span className={styles.hint}>Increases spacing around the center icon for clearer separation from QR modules.</span>
          </label>

          <div className={styles.tipBox}>
            Keep contrast high between the background and modules to preserve scan reliability.
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Download format</span>
            <div className={styles.radioGroup}>
              {(['png', 'jpeg'] as const).map((fmt) => (
                <label key={fmt} className={`${styles.radioOption} ${options.downloadFormat === fmt ? styles.radioOptionActive : ''}`}>
                  <input
                    type="radio"
                    name="downloadFormat"
                    value={fmt}
                    checked={options.downloadFormat === fmt}
                    onChange={() => setOptions({ ...options, downloadFormat: fmt })}
                    className={styles.srOnly}
                  />
                  {fmt.toUpperCase()}
                  {fmt === 'jpeg' && options.transparentBg && <span className={styles.radioNote}>(no alpha)</span>}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
