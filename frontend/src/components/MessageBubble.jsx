import { CourseCard } from "./CourseCard";

export function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`message-row ${isUser ? "message-row-user" : "message-row-assistant"}`}>
      <div className={`message-bubble ${isUser ? "message-bubble-user" : "message-bubble-assistant"}`}>
        {message.text}
      </div>
      {message.courses?.length > 0 && (
        <div className="course-card-list">
          {message.courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
