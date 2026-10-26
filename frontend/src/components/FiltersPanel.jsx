import { useState } from "react";
import Icon from "./Icon";
import { useLanguage } from "../hooks/useLanguage";
import { DAYS } from "../utils/timetable";
export default function FiltersPanel({
  values,
  onChange,
  onApply,
  onReset,
  faculties,
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const set = (key, value) =>
    onChange({
      ...values,
      [key]: value,
    });
  return (
    <aside className={`filters ${expanded ? "filters-expanded" : ""}`}>
      <button
        className="filter-disclosure"
        type="button"
        aria-expanded={expanded}
        aria-controls="discovery-filters"
        onClick={() => setExpanded((value) => !value)}
      >
        <Icon name="filter" />
        {t("Filters")}
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      <h2 className="filter-title">{t("Filters")}</h2>
      <form
        id="discovery-filters"
        onSubmit={(e) => {
          e.preventDefault();
          onApply();
        }}
      >
        <label>
          {t("Faculty")}
          <select
            value={values.faculty}
            onChange={(e) => set("faculty", e.target.value)}
          >
            <option value="">{t("All faculties")}</option>
            {faculties.map((faculty) => (
              <option key={faculty} value={faculty}>
                {t(faculty)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={values.offered_only}
            onChange={(e) => set("offered_only", e.target.checked)}
          />{" "}
          {t("Has sections in this snapshot")}
        </label>
        <div className="field-pair">
          <label>
            {t("Min credits")}
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={values.min_credits}
              onChange={(e) => set("min_credits", e.target.value)}
            />
          </label>
          <label>
            {t("Max credits")}
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={values.max_credits}
              onChange={(e) => set("max_credits", e.target.value)}
            />
          </label>
        </div>
        <fieldset>
          <legend>{t("Available days")}</legend>
          <p className="hint">
            {t("Every meeting must fit the days and times you choose.")}
          </p>
          <div className="days">
            {DAYS.map((day) => (
              <label key={t(day)}>
                <input
                  type="checkbox"
                  checked={values.days.includes(day)}
                  onChange={() =>
                    set(
                      "days",
                      values.days.includes(day)
                        ? values.days.filter((d) => d !== day)
                        : [...values.days, day],
                    )
                  }
                />
                {t(day)}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          {t("Earliest start")}
          <input
            type="time"
            value={values.start_time}
            onChange={(e) => set("start_time", e.target.value)}
          />
        </label>
        <label>
          {t("Latest end")}
          <input
            type="time"
            value={values.end_time}
            onChange={(e) => set("end_time", e.target.value)}
          />
        </label>
        <button className="primary">{t("Apply filters")}</button>
        <button type="button" onClick={onReset}>
          {t("Reset filters")}
        </button>
      </form>
    </aside>
  );
}
