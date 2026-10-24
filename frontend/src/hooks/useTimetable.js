import { useContext } from "react";
import { TimetableContext } from "../context/timetable";
export const useTimetable = () => useContext(TimetableContext);
