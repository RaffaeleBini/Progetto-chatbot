export function CourseCard({ course }) {
  return (
    <div className="course-card">
      <h4>{course.title}</h4>
      <p>{course.description}</p>
      <div className="course-card-meta">
        <span>⏱ {course.duration}</span>
        <span>{course.remote ? "💻 Remoto" : "📍 In presenza"}</span>
      </div>
      <div className="course-card-skills">
        {course.skills?.map((skill) => (
          <span key={skill} className="skill-badge">
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}
