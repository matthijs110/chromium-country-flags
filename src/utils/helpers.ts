type HostnameValidation = { valid: boolean; hostname?: string; path?: string };
export const isValidUrlOrHostname = (input: string): HostnameValidation => {
  try 
  {
    // Try to parse the input as a URL
    const url = new URL(input);

    // If the input is successfully parsed, return the hostname and path
    return { valid: true, hostname: url.hostname, path: url.pathname };
  } 
  catch (error) 
  {
    // If parsing as URL fails, check if the input is a valid hostname using a regex
    const hostnameRegex = /^(?!:\/\/)([a-zA-Z0-9-_]{1,63}\.)+[a-zA-Z]{2,63}$/;

    if (hostnameRegex.test(input)) {
      // If it's a valid hostname, return the hostname without a path
      return { valid: true, hostname: input };
    }

    // If neither URL nor hostname, return invalid
    return { valid: false };
  }
};

export const generateRandomId = () => {
  const timestamp = Date.now().toString(36);
  const randomNum = Math.random().toString(10).substring(2, 10);
  return timestamp + randomNum;
};
