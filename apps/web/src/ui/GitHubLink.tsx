import { GITHUB_URL } from "../../../../packages/shared/site-meta";

export function GitHubLink() {
  return (
    <a className="github-link" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
      <span aria-hidden="true">☆</span> Star on GitHub
    </a>
  );
}
