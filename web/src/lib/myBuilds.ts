// There are no accounts, so "your builds" are the ones this browser created or opened.
// Their ids live in localStorage; anyone else needs the build's link.

const KEY = 'apostasy.builds';

export function myBuildIds(): string[] {
	try {
		const ids = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];
	} catch {
		return [];
	}
}

function store(ids: string[]) {
	try {
		localStorage.setItem(KEY, JSON.stringify(ids));
	} catch {
		// Storage blocked (private window): the list just won't be remembered.
	}
}

export function rememberBuild(id: string) {
	const ids = myBuildIds();
	if (!ids.includes(id)) store([id, ...ids]);
}

export function forgetBuild(id: string) {
	store(myBuildIds().filter((x) => x !== id));
}
