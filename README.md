# Unmock Visual Studio Code Plugin

Unmock Visual Studio Code plugin - synchronizing seamlessly with all your unmock needs!

## Development
**Quick Links**:
1. [Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
2. [Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
3. [Bundling](https://code.visualstudio.com/api/working-with-extensions/bundling-extension)
4. [CI and Tests](https://code.visualstudio.com/api/working-with-extensions/continuous-integration)  
**Current Development Status**: Pre-alpha  
**Current Status and Features**:  
- Syncing updates JSON mock files to unmock cloud
- Suggestion to use unmock in javascript/typescript test files, where calls are made to 3rd party APIs.
  - Adds a `beforeEach`, `afterEach` and `import` statements to use unmock.
- Roadmapped for further extensions, features and integrations.

## Dev Instructions
### Testing locally (installing the plugin)
- Test the plugin by running debug mode in the plugin project.
- Compile the plugin by running `vsce package`. A `.vsix` file will be generated. Install the `.vsix` file locally by either:
  1. Using the CLI: `code --install-extension <vsix file>`
  1. Opening the Extension Manager in vscode (normally CTRL+SHIFT+X), and choosing `Install from VSIX...`

### Publishing
- Run `vsce login Unmock`. Enter the _Personal Access Token_ (ask Idan if you need it).
  - You only need to login once.
- Run `vsce package`.
- Run `vsce publish minor` if you want to increment the minor version, `vsce publish major` for major version, or `vsce publish X.Y.Z` for a specific version number.

## Extension Settings
- `refreshToken`: The refresh token to get when you registered for unmock. Used for various operations with the remote unmock service.
- `path`: Default path to look for stored credentials (relative to the workspace or absolute path).

## Known Issues
- Only initial release at the moment.
- Manually tested

## Release Notes

### 0.0.0
Released: 10/04/2019.  
Initial release, limited functionality.

