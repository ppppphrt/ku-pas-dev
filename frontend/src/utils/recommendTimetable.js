import { minutes, overlap } from "./timetable";

function placement(slots) {
  const days = new Map();
  for (const slot of slots) {
    if (!days.has(slot.day)) days.set(slot.day, []);
    days.get(slot.day).push(slot);
  }
  let gaps = 0;
  for (const day of days.values()) {
    day.sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < day.length; i++)
      gaps += Math.max(0, minutes(day[i].start) - minutes(day[i - 1].end));
  }
  return { days: days.size, gaps };
}

export function recommendTimetables(results, saved, limit, target) {
  const existing = new Set(saved.map(({ course }) => course.subject_code));
  const baseline = {
    items: [],
    slots: saved.flatMap(({ section }) => section.time_slots),
    credits: saved.reduce((sum, { course }) => sum + (course.credits ?? 0), 0),
    competencies: new Set(),
    verified: 0,
    targetWeight: 0,
  };
  const candidates = results.filter(
    ({ course }) =>
      course.campus === "บางเขน" &&
      !existing.has(course.subject_code) &&
      Number.isFinite(course.credits),
  );

  function build(forCompetency) {
    let pool = [baseline];
    for (const { course, classification, sections } of candidates) {
      // Different section IDs with identical times produce the same plan.
      const patterns = new Set();
      const options = sections.filter(({ section, can_plan }) => {
        if (
          !can_plan ||
          section.campus !== "บางเขน" ||
          !section.schedule_complete ||
          !section.time_slots.length
        )
          return false;
        const key = section.time_slots
          .map(({ day, start, end }) => day + start + end)
          .sort()
          .join("|");
        if (patterns.has(key)) return false;
        patterns.add(key);
        return true;
      });
      const skills =
        classification.status === "verified" || classification.status === "mock"
          ? classification.competencies
          : [];
      if (
        forCompetency &&
        (!skills.length || (target && !skills.includes(target)))
      )
        continue;
      const expanded = [...pool];
      for (const plan of pool) {
        if (plan.credits + course.credits > limit) continue;
        for (const { section } of options) {
          if (
            section.time_slots.some((slot) =>
              plan.slots.some((other) => overlap(slot, other)),
            )
          )
            continue;
          expanded.push({
            items: [...plan.items, { course, section, classification }],
            slots: [...plan.slots, ...section.time_slots],
            credits: plan.credits + course.credits,
            competencies: new Set([...plan.competencies, ...skills]),
            targetWeight:
              plan.targetWeight +
              (classification.competency_weights?.[target] ?? 0),
            verified:
              plan.verified +
              Number(classification.status === "verified" && skills.length > 0),
          });
        }
      }
      const ranked = expanded.map((plan) => ({
        plan,
        ...placement(plan.slots),
      }));
      ranked.sort(
        (a, b) =>
          (forCompetency
            ? b.plan.targetWeight - a.plan.targetWeight ||
              b.plan.competencies.size - a.plan.competencies.size ||
              b.plan.verified - a.plan.verified
            : 0) ||
          b.plan.items.length - a.plan.items.length ||
          a.days - b.days ||
          a.gaps - b.gaps,
      );
      pool = ranked.slice(0, 48).map(({ plan }) => plan);
    }
    return pool[0].items;
  }

  return { time: build(false), competency: build(true) };
}
