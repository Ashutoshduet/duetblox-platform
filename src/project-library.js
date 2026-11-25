// Stable identities keep Save from adding duplicates. Copies are deliberately new
// projects. Never trim the library: a storage failure must leave earlier work intact.
export function saveLibraryProject(projects, record) {
  return [record, ...projects.filter(project => project.id !== record.id)];
}

export function setProjectDeleted(projects, id, deleted, now = Date.now()) {
  return projects.map(project => {
    if (project.id !== id) return project;
    const updated = {...project};
    if (deleted) updated.deletedAt = now;
    else delete updated.deletedAt;
    return updated;
  });
}
