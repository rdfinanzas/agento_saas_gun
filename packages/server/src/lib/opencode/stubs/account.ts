// Stub for @/account - Account management not needed in server environment
// Accounts are managed through the AgenTo tenant system

export const Account = {
  get: async () => null,
  list: async () => [],
  create: async () => { throw new Error("Account creation not available in server environment") },
  update: async () => { throw new Error("Account update not available in server environment") },
  delete: async () => { throw new Error("Account deletion not available in server environment") },
}

export const AccountService = {
  get: async () => null,
  list: async () => [],
  getCurrent: async () => null,
}

export type AccountInfo = {
  id: string
  email?: string
  name?: string
  createdAt?: Date
  updatedAt?: Date
}

export default Account
