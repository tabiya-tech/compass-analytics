[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# Compass Analytics

Compass Analytics is the partner-facing analytics dashboard for Tabiya Compass — giving implementers and funders
visibility into deployment reach, module engagement, and jobseeker outcomes across the institutions they run Compass in.

## Table of Contents

- **[Frontend](frontend)**: Explore the Frontend directory for detailed insights about the frontend React project.
- **[Backend](backend)**: Explore the Backend directory for detailed insights about the FastAPI backend project.
- **[Infrastructure As Code (IaC)](iac)**: Not yet implemented.
- **[Contribution Guidelines](#contribution-guidelines)**: Help us improve the project by contributing to various aspects.
- **[Getting Started](#getting-started)**: Easy steps to set up your environment and start contributing.
- **[License](#license)**: The project is licensed under MIT License.

## Why Contribute?

- **Make an Impact:** Your contributions directly improve how partners understand and act on Compass deployment data.
- **Help Achieve Our Goals:** By contributing, you're supporting Tabiya's mission to give implementers and funders the
  visibility they need to run effective, evidence-based deployments.

## Ways to Contribute

1. **Reporting Issues:** If you encounter bugs or have suggestions, open an issue on GitHub. Your feedback is valuable.
2. **Code Contributions:** Help enhance the codebase by submitting pull requests.
3. **Write or Improve Tests:** You can help by writing or improving tests.
4. **Documentation:** Improve project documentation by submitting pull requests. Clear documentation is crucial for new
   contributors.

## Contribution Guidelines

🎉 Thank you for considering contributing to Compass Analytics! 🎉

### Code Formatting

#### Frontend

We follow the **[Prettier](https://prettier.io/)** code formatting guidelines to make sure the code is properly
formatted in a uniform way.

You can find the configuration in the **[.prettierrc.json](frontend/.prettierrc.json)** file.

> **Note:**
> For IntelliJ IDEA, if you make changes to the Prettier config, you may need to restart the IDE before formatting
> code using the IDE's formatting function.

#### Backend

We use **pylint** (with `pylint-pydantic`) as our linting tool for the Python backend.

You can find the configuration in the **[.pylintrc](backend/.pylintrc)** file.

### Conventional Commits

Please follow the **[Conventional Commits](https://www.conventionalcommits.org/)** format for commit messages.

### Guidelines for Readable BDD Testing

To contribute to our code coverage goal, refer to our "Guidelines for Readable BDD Testing" in the
**[testing-guidelines.md](testing-guidelines.md)**.

### Guidelines for Snapshot Testing

To ensure component stability, refer to our "Snapshot Testing Guidelines" in the
**[snapshot-testing-guidelines.md](snapshot-testing-guidelines.md)**.

## Getting Started

To work with this repository you should have a system with a bash compatible terminal (linux, macOS, cygwin) as most
of the scripts are written for bash and will not work on windows cmd or powershell.

1. Fork the repository and clone it to your local environment.

2. Create a new branch for your changes.

3. Set up each individual subproject. e.g. if you are working on `frontend/` follow instructions in `frontend/README.md`.

4. After making your changes, ensure the code is clean, properly formatted and passes all tests.

   You can use the provided script, `run-before-merge.sh`, for assistance. This script performs checking of the code
   formatting, linting, building, and testing on the subprojects of the repository. To run it, use the following
   command:

   ```bash
   ./run-before-merge.sh
   ```

   If you get any errors, fix them before proceeding. A common source of errors is not fully completing step `3` from
   above.

5. Commit them and push to your fork.

6. Use descriptive commit messages following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

7. Open a pull request to our main branch.

Happy contributing! 🚀

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
