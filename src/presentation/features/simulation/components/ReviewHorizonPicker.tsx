import { REVIEW_HORIZONS, type ReviewHorizonId } from "../../../../domain/workspace/outcomeReview";

type Props = {
  value: ReviewHorizonId;
  onChange: (id: ReviewHorizonId) => void;
  disabled?: boolean;
};

/**
 * When to come back and say how this landed.
 *
 * A default is preselected on purpose — an empty chooser means most saves carry
 * no date, the queue stays empty, and calibration keeps starving. Saving stays
 * one click either way.
 *
 * The copy says "check back", never "remind" or "notify": this surfaces the
 * decision in the workspace when the date arrives. Nothing is sent anywhere.
 */
export function ReviewHorizonPicker({ value, onChange, disabled }: Props) {
  return (
    <fieldset className="mt-3" disabled={disabled}>
      <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
        Check back on this
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {REVIEW_HORIZONS.map((horizon) => (
          <label
            key={horizon.id}
            className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-chronos has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-bg ${
              value === horizon.id
                ? "border-chronos bg-chronos/15 text-chronos"
                : "border-line text-ink-dim hover:border-chronos/40"
            }`}
          >
            <input
              type="radio"
              name="review-horizon"
              className="sr-only"
              value={horizon.id}
              checked={value === horizon.id}
              onChange={() => onChange(horizon.id)}
            />
            {horizon.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
